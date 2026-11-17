# 02 アーキテクチャ

## ディレクトリ構成

```
app/                       # expo-router の画面（薄く保つ。ロジックを書かない）
  _layout.tsx
  index.tsx                # ホーム
  capture.tsx              # 撮影
  import.tsx               # ギャラリーから2枚選択
  result.tsx               # 合成結果・パラメータ調整・保存
  benchmark.tsx            # 計測
src/
  config/constants.ts      # 数値定数（解像度、しきい値、既定パラメータ）
  types/index.ts           # 共通型
  camera/
    useCameraSetup.ts      # デバイス・フォーマット選択、権限
    focusPoints.ts         # 正規化座標 → ビュー座標の変換
    strategies/
      types.ts             # CaptureStrategy インターフェース
      sequentialFocus.ts   # S1
      snapshotFocus.ts     # S2
      index.ts             # 戦略レジストリ
    captureSequence.ts     # 戦略を呼び出して計測する
  imaging/
    loadImage.ts           # URI → SkImage（向き補正込み）
    orientation.ts
    downscale.ts
    colorStats.ts          # 平均・分散の算出と色合わせパラメータ
    saveImage.ts           # エンコード、一時保存、ギャラリー保存
    syntheticPair.ts       # テスト用NEAR/FAR擬似ペア生成
  fusion/
    align.ts               # 平行移動の推定
    sharpness.ts           # 鮮鋭度マップ生成（シェーダー）
    fuse.ts                # マスク生成とブレンド（公開API）
    shaders/*.ts           # SkSL ソース文字列
    params.ts              # FusionParams 既定値
  perf/
    timeline.ts            # 計測マーク
    stats.ts               # 中央値・p90
    focusVerify.ts         # ピント検証
  ui/                      # 再利用コンポーネント
  state/                   # 画面間で共有する状態（Context）
docs/DECISIONS.md          # 決定・食い違い・実測値の記録
```

## 層の分離ルール

- `app/` → `src/ui`, `src/state` を使う。`src/camera`、`src/fusion` を直接呼ぶのは、フックやサービス経由に限る。
- `src/fusion` と `src/imaging` は **カメラに依存しない**（URI または SkImage を入力とする）。そのためギャラリー画像でも同じ合成が動く。
- 純粋関数（座標変換、統計、位置合わせの探索、ピント検証）はフレームワーク非依存にして、単体テストを書く。
- 副作用（ファイルI/O、カメラ）は `camera/` と `imaging/` に閉じ込める。

## 共通型（`src/types/index.ts`）

```ts
export type NormalizedPoint = { x: number; y: number }; // 0..1、プレビュー座標系

export type CapturedPhoto = {
  uri: string;               // file:// URI
  width: number;
  height: number;
  orientation: string;       // 撮影ライブラリが返す向き情報（型は版に合わせる）
  focusPoint: NormalizedPoint;
  role: 'NEAR' | 'FAR';
};

export type TimelineMark = { label: string; t: number }; // performance.now() ms

export type CaptureResult = {
  near: CapturedPhoto;
  far: CapturedPhoto;
  timeline: TimelineMark[];
  totalMs: number;           // ボタン押下 → 2枚目撮影完了
  strategyId: string;
};

export type FusionParams = {
  workLongSide: number;      // 解析解像度（長辺）
  sharpWindowRadius: number; // 鮮鋭度の局所平均半径(px, 作業解像度)
  maskBlurRadius: number;    // マスクのぼかし半径
  threshold: number;         // 差の閾値（smoothstep幅）
  nearBias: number;          // 正ならNEAR寄り
  haloShrink: number;        // 境界のにじみ対策（マスクの収縮量）
  colorMatch: boolean;       // FARをNEARの色に合わせる
  align: boolean;            // 位置合わせを行う
};

export type FusionTimings = {
  loadMs: number; alignMs: number; sharpnessMs: number; blendMs: number; encodeMs: number; totalMs: number;
};

export type FusionResult = {
  imageUri: string;
  width: number;
  height: number;
  timings: FusionTimings;
  alignOffset: { dx: number; dy: number };
};
```

## データフロー

```
[撮影 capture.tsx]  focusPoints ──▶ captureSequence(strategy) ──▶ CaptureResult(near, far, timeline)
                                                                        │
[ギャラリー import.tsx] URI×2 ──────────────────────────────────────────┤
                                                                        ▼
                                  fuse(nearUri, farUri, params) ──▶ FusionResult
                                       │ loadImage → align → colorMatch → sharpness → mask → blend → encode
                                                                        ▼
                                                              result.tsx（表示・調整・保存）
```

## 状態管理

- 追加ライブラリは入れない。React Context + `useReducer` で、`CaptureResult` と `FusionParams` を保持する。
- 大きな画像データ（SkImage）を state に長く保持しない。URI を保持し、必要時に読み込む。使い終わった SkImage は参照を手放す。

## 設計方針

- 撮影戦略は `CaptureStrategy` インターフェースで差し替え可能にする（03・08 を参照）。
- 合成の公開APIは `fuse(near, far, params, onProgress?)` の1つにまとめる。内部を差し替えられるようにする。
- 定数は `constants.ts` に集約し、マジックナンバーを散らさない。
