# 決定・食い違い・実測の記録

## 環境（M0）

| 項目 | 値 |
|---|---|
| Expo SDK | 58.0.25 |
| React Native | 0.88.1 |
| react-native-vision-camera | 5.2.4 |
| @shopify/react-native-skia | 2.14.0 |
| Android package | `com.example.stuffedcam` |
| Development Build | expo-dev-client |

## Windows ビルド（実測）

- Cursor 内ターミナルのサンドボックスでは Gradle キャッシュが `cursor-sandbox-cache` 配下になり、最初は nitro 系で **260 文字パス**エラーが出た。`GRADLE_USER_HOME=C:\gradle-home` と `-g C:\gradle-home` で緩和。
- その後 `:app:buildCMakeDebug`（Fabric の codegen）でも同様の **ninja 260 文字**制限が発生（パスに `C:/Users/akiyama/Project/oshi/node_modules/...` が含まれるため）。
- 原因: Expo SDK 58 は全モジュールに `-DCMAKE_OBJECT_PATH_MAX=1024` を渡して CMake のパス短縮を無効にする（`expo-modules-autolinking` の `ExpoRootProjectPlugin.kt`）。一方、既定の CMake 3.22.1 に同梱の Ninja 1.10.2 は 260 文字超のパスを扱えない。`:app` の `build.ninja` には 278 文字と 263 文字のオブジェクトパスがあった。
- 対策（採用）: `app.json` の `expo-build-properties` で `android.cmakeVersion = "3.31.6"`（同梱 Ninja 1.12.1 は長いパス対応）。SDK に `cmake;3.31.6` を追加し、Windows の `LongPathsEnabled = 1` が前提。プロジェクトを浅いパスへ移す必要はない。
- ABI の絞り込みは `android/gradle.properties` の手編集をやめ、`expo-build-properties` の `buildArchs: ["arm64-v8a"]` に移した（prebuild は `android/` を作り直すため、手編集は消える）。
- 実測: `C:\Users\akiyama\Project\oshi` のまま `gradlew app:assembleDebug -PreactNativeArchitectures=arm64-v8a` が成功（9 分 36 秒、`app-debug.apk` 生成）。

## Android 権限

- `react-native-vision-camera` v5 には Expo config plugin が同梱されていないため、`app.json` の `android.permissions` で `CAMERA` 等を宣言する。

## API 差分

- **仕様書の `focus()`** → vision-camera v5 では **`CameraRef.focusTo(viewPoint)`** を採用（`docs/DECISIONS.md` 参照）。
- **仕様書の `takePhoto` on Camera ref** → v5 では **`usePhotoOutput()` + `capturePhotoToFile()`** を採用。
- **expo-file-system** → 書き込みは `expo-file-system/legacy` の `cacheDirectory` + `writeAsStringAsync`（SDK 58 の新 API は別途移行可能）。
- **`supportsFocus`** → `CameraDevice.supportsFocusMetering` に読み替え。

## 実装スコープ（この段階）

- **M3〜M9** を JS 側で実装済み。合成の位置合わせ・簡易色合わせは既定 **ON**（`FusionParams.align` / `colorMatch`）。
- ベンチマークは 10 回計測後に JSON をクリップボードへコピー。中央値が 1000ms 以下を簡易判定。
- ピント検証は 512px グレースケール上のラプラシアン比（`FOCUS_VERIFY_K=1.15`）。
- ネイティブでのレンズ位置直接指定は行わない（将来案として 03 に記載のとおり）。
- 撮影順序は **FAR（背景）→ NEAR（ぬい）**。最後に背景点をタップした状態でシャッターを押す操作と一致させる（`photoA`=FAR, `photoB`=NEAR）。
- ピント検証は診断の画質比較と同じ **長辺512px・領域15%・ラプラシアン分散**（`FOCUS_VERIFY_LONG_SIDE`）。Vision Camera の `left`/`right` は `orientationToDegrees` で回転し、座標の x/y 入替えは行わない（画像を上向きにしてからプレビューと同じ正規化座標を使う）。

## マスクぼかし

- 作業解像度のマスクに Skia `ImageFilter.MakeBlur` を適用（シェーダー内ループではなくオフスクリーン描画）。速度は実機で要計測。

## マスク生成（正規化差）

- 判定は正規化差 `d = (sN - sF) / (sN + sF + eps)`（-1〜1）。`threshold`（既定 0.15）・`nearBias`（既定 0.02）・`haloShrink` はすべて d の単位。
- `sharpWindowRadius`（既定 6）は作業解像度での窓の半径 px。ガウスの sigma には `半径/√3` で換算する（`windowRadiusToSigma`）。`maskBlurRadius` は従来どおり sigma として扱う。
- 鮮鋭度マップは 8bit のため `sqrt(lap / SHARPNESS_LAP_MAX)` で格納し、マスク側で 2 乗して戻す。窓平均は符号化後の値に掛かるため、厳密な平均より疎なエッジの寄与がやや小さい。
- 低テクスチャ（`sN + sF` が `MASK_LOW_TEXTURE_LO`〜`HI` 未満）は、確からしさで重み付けしたマスクを半径 `MASK_FILL_BLUR_RADIUS`（32px）でぼかした値で補う。周囲にもテクスチャが無ければ FAR（0）に寄せる。
- `MASK_EPS`・`MASK_LOW_TEXTURE_LO/HI` は実機未計測の見積もり値。診断レポートの「鮮鋭度マップ・正規化差」の値域を見て調整する。
- 修正前のラプラシアンは隣接画素を `1/幅` px 先で参照しており（座標はピクセル単位）、出力が最大でも 1/255 だった。旧マスクは `max(sN, sF) < 0.01` で 0.5 を返すため、全画素が 0.5 になっていた。隣接参照は ±1px に修正済み。
- 式の CPU 実装は `src/fusion/maskCore.ts`（シェーダーと同じ式、単体テストあり）。