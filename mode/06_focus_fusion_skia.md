# 06 フォーカス合成（Skia シェーダー）

## 目的

2枚（NEAR, FAR）から、各領域でシャープな方を採用した1枚を、GPU（Skia の SkSL ランタイムシェーダー）で高速に作る。

## 全体パイプライン

```
NEAR, FAR (SkImage, フル解像度)
  │ ① 作業解像度に縮小
  ▼
鮮鋭度マップ S_near, S_far     （ラプラシアン絶対値 → 局所平均）
  ▼
決定マップ D = S_near − S_far + nearBias
  ▼
マスク M = smoothstep(−threshold, +threshold, D) → ぼかし → 収縮（haloShrink）
  ▼
フル解像度ブレンド：out = mix(FAR', NEAR, M)    ※FAR' = 位置合わせ・色合わせ後のFAR
  ▼
エンコード・保存
```

## SkSL の実装方針

- Skia の `RuntimeEffect`（`Skia.RuntimeEffect.Make(source)`）を使う。**シェーダー作成が null になった場合は、SkSL のコンパイルエラーなので、エラーメッセージをログ出力する。**
- 複数画像は、`uniform shader` の子シェーダーとして渡す（`ImageShader` を使う）。
- 座標は、キャンバスのピクセル座標で渡される。画像の解像度とキャンバスの解像度が違う場合は、スケールを `uniform` で渡す。

### ステージ1：鮮鋭度（作業解像度）

- グレースケール化（輝度 = 0.299R + 0.587G + 0.114B）。
- 3×3 ラプラシアンの絶対値を計算する（隣接ピクセルを `eval(xy + float2(±1, 0))` で参照）。
- 局所平均：`sharpWindowRadius` の範囲で平均する。実装は次のいずれか。
  - (a) シェーダー内で小さな窓をループ（半径が小さい場合）。
  - (b) ラプラシアン画像をオフスクリーンに描いたあと、Skia の `ImageFilter` のぼかし（Blur）で平均化する。
  - どちらが速いかを実測し、`docs/DECISIONS.md` に記録する。
- 出力：S_near, S_far を、それぞれオフスクリーン `Surface` に描画した `SkImage`（作業解像度）。

### ステージ2：マスク

- 入力：S_near, S_far の画像。
- `d = (sN - sF) + nearBias`
- `m = smoothstep(-threshold, threshold, d)`
- **低テクスチャ領域の処理**：`sN` と `sF` の両方が小さい（例：`max(sN, sF) < eps`）場所では、判断が不安定になる。そこは、周囲のマスクを大きな半径でぼかした値に寄せる（または、被写体点の周辺を NEAR、それ以外を FAR などの既定値を `nearBias` で与える）。
- マスクを、`maskBlurRadius` でぼかす（フェザリング）。
- `haloShrink`：被写体の輪郭では、FAR 側で被写体のボケが背景ににじむ。マスクの NEAR 側を少し収縮（または膨張）させる調整値を用意する。符号の意味を、UI のラベルで分かるようにする。

### ステージ3：最終ブレンド（出力解像度）

- 子シェーダー：NEAR、FAR、マスク（作業解像度のものをバイリニアで拡大）。
- `uniform`：FAR のオフセット `(dx, dy)`、色合わせの `gain`（float3）と `offset`（float3）、マスクのスケール。
- `out = mix(farAdjusted, near, mask)`。
- オフスクリーン `Surface` に出力解像度で描画し、`makeImageSnapshot()` を得る。

## 参考スケルトン（疑似コード。そのまま動く保証はない）

```glsl
uniform shader imgNear;
uniform shader imgFar;
uniform shader maskImg;
uniform float2 farOffset;
uniform float3 colorGain;
uniform float3 colorBias;
uniform float2 maskScale;

half4 main(float2 xy) {
  half4 n = imgNear.eval(xy);
  half4 f = imgFar.eval(xy + farOffset);
  f.rgb = clamp(f.rgb * colorGain + colorBias, 0.0, 1.0);
  half m = maskImg.eval(xy * maskScale).r;
  return mix(f, n, m);
}
```

- `colorGain` / `colorBias` は、04 で求めた補正係数（`(far - meanFar) * ratio + meanNear` を、ゲインとバイアスの形に展開する）。

## プレビュー用の低解像度合成

- 結果画面でパラメータをスライダーで動かしたとき、**低解像度（長辺 1024px）で即座に再合成して表示する**（目標 500ms 以内、できればより速く）。
- 「保存」を押したときだけ、出力解像度で合成してエンコードする。
- 鮮鋭度マップ（ステージ1）は、パラメータが変わらない限り再利用する（キャッシュ）。

## デバッグ表示（必須）

結果画面で次を切り替えて見られるようにする：

1. 合成結果
2. NEAR のみ
3. FAR のみ（位置合わせ後）
4. マスク（白＝NEAR）
5. S_near、S_far（鮮鋭度マップ、見やすいよう正規化して表示）
6. マスクを合成結果に半透明でオーバーレイ

## 手動補正マスク（M9・任意）

- 自動マスクが失敗した領域を、指でなぞって修正できる。
- ブラシで「ここはNEAR」「ここはFAR」を描く。ブラシ半径とぼかし量を調整可能にする。
- 実装：マスクを描き込む `Surface` に、`Path` をブレンドモードで描き重ねる。元に戻す（Undo）を1段以上。
- 手動補正は、自動マスクの上に重ねるレイヤーとして持ち、リセットできるようにする。

## 品質のチェック観点

- 被写体の輪郭（毛並み）で、不自然な縁取り・二重像が出ないか。
- 背景が無地の領域で、マスクがまだらにならないか。
- 位置合わせが外れたとき、ゴースト（二重像）が出ないか（出た場合は `align` の信頼度が低いサインとして、警告を出す）。

## 性能目標（中級機）

| 処理 | 目標 |
|---|---|
| ステージ1+2（作業解像度） | 200ms以内 |
| ステージ3（12MP出力） | 500ms以内 |
| エンコード（JPEG 12MP） | 800ms以内（参考値） |

実測値は `FusionTimings` に記録し、ベンチマーク画面（08）に表示する。

## 代替案（Skia のオフスクリーンが端末で不安定な場合）

- 画面上の `<Canvas>` に描画し、`useCanvasRef` の `makeImageSnapshot` で取得する。
- さらに駄目なら、低解像度（長辺 1024）の CPU 実装（JSの配列処理）にフォールバックし、画質低下の警告を出す。いずれの場合も `docs/DECISIONS.md` に記録する。

## やらないこと

- 機械学習ベースのセグメンテーション・深度推定
- 3枚以上のスタッキング（`fuse` のシグネチャは、将来 `images[]` に拡張できる余地を残す程度にとどめる）
