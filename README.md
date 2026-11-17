# ぬいぐるみ全面ピント合成カメラ（Expo Dev Client）

仕様書は `mode/`（旧 `ai-prompts/`）を参照。

## ビルド（初回）

Windows では C++ ビルドのオブジェクトパスが 260 文字を超えるため、既定の CMake 3.22.1（同梱 Ninja 1.10.2）では `Filename longer than 260 characters` で失敗します。`app.json` の `expo-build-properties` で `cmakeVersion: "3.31.6"` を指定済みなので、次の 2 点を満たせば今のパスのままビルドできます。

- Android SDK に **CMake 3.31.6** が入っている（Android Studio の SDK Manager > SDK Tools > Show Package Details、または `sdkmanager "cmake;3.31.6"`）
- Windows の長いパスが有効（レジストリ `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled = 1`）

`android/` は生成物です。ネイティブ設定は `app.json` で変更し、`npx expo prebuild --platform android` で反映してください（`android/` は作り直されます）。

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "C:\gradle-home"
$env:TMP = "C:\tmp-build"
$env:TEMP = "C:\tmp-build"
npm install --legacy-peer-deps
npx expo prebuild --platform android
pwsh .\scripts\build-android.ps1
# 実機接続時: npx expo run:android --device
```

APK 出力: `android\app\build\outputs\apk\debug\app-debug.apk`

以降の JS 変更:

```bash
npx expo start --dev-client
```

## 検証（開発者向け）

```bash
npx tsc --noEmit
npm test
```

## 実装済みマイルストーン（このリポジトリ）

- **M0** Dev Client 構成、ホームの Skia 描画、撮影画面のカメラプレビュー
- **M1** 型・定数・`timeline` / `stats` と単体テスト
- **M2** 画像読込・向き補正・保存（`app/io-test.tsx`）
- **M4** ギャラリー2枚合成・結果画面でのパラメータ調整（低解像度プレビュー再合成）
- **M3** 擬似 NEAR/FAR 生成（`app/synthetic.tsx`）、結果画面で PSNR 表示
- **M5** 勾配ベース位置合わせ・簡易色合わせ（既定 ON）
- **M6** 撮影戦略 S2（スナップショット）/ S3（固定遅延）
- **M7** ベンチマーク（`app/benchmark.tsx`）、ピント検証、設定で戦略・解像度
- **M8** 撮影→自動で結果→保存、権限・設定・エラー表示
- **M9** 手動補正マスク（結果画面）

未実装: ネイティブレンズ直接制御・実機でのビルド検証（浅いパスでの `assembleDebug` 推奨）