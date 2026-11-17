# 01 開発環境・依存パッケージ・ビルド

## 前提（ユーザー側で用意済みとする）

- Node.js LTS、JDK 17、Android Studio（SDK・Build-Tools・Platform-Tools）
- `JAVA_HOME` / `ANDROID_HOME` 設定済み
- 実機の USB デバッグ有効、`adb devices` で認識済み

AI は環境変数や実機接続を確認するコマンドを案内してよいが、システム設定を勝手に変更しない。

## プロジェクト初期化

- 空のリポジトリなら `npx create-expo-app@latest` の既定テンプレート（TypeScript、expo-router）で作る。
- すでにプロジェクトがある場合は、それを使う。
- Expo SDK は、作成時点の最新安定版を使う。バージョンは `docs/DECISIONS.md` に記録する。

## 依存パッケージ

**必ず `npx expo install <pkg>` で入れる**（SDKに合う版が選ばれる）。

| パッケージ | 用途 |
|---|---|
| `expo-dev-client` | Development Build |
| `react-native-vision-camera` | カメラ（フォーカス指定、撮影） |
| `@shopify/react-native-skia` | GPU合成（SkSLシェーダー） |
| `expo-image-picker` | ギャラリーから2枚選択（検証モード） |
| `expo-media-library` | 結果の保存 |
| `expo-file-system` | 一時ファイルの読み書き（版によりAPIが異なる。インストール版の型定義を確認） |
| `expo-image-manipulator` | 必要な場合のみ（向き補正や縮小の補助） |
| `react-native-reanimated` / `react-native-worklets` 等 | 上記の peer dependency として警告が出た場合のみ追加 |

開発用：`jest-expo`、`@types/jest`、`eslint`（テンプレートに含まれるものを使う）。

### 追加の注意
- `react-native-vision-camera` は版によって、必要な追加パッケージ・New Architecture 対応状況・最小 Android SDK が異なる。**インストール後に公式ドキュメントの Installation / Android 節を読み、要求を満たす。**
- フレームプロセッサ（Frame Processor）は使わない。したがって `react-native-worklets-core` が不要なら入れない。
- 最小 SDK などの Android ビルド設定が必要な場合は `expo-build-properties` の config plugin で設定する（`android/` を直接編集しない。prebuild で上書きされるため）。

## app.json（app.config.ts）の設定

- `plugins` に `react-native-vision-camera`（`cameraPermissionText` を日本語で設定）、`expo-media-library`（保存権限の文言）、`expo-image-picker` を追加する。
- `android.package` を設定する（例：`com.example.stuffedcam`。ユーザーが後で変更できるよう定数1か所にまとめる）。
- 画面の向きは `portrait` 固定。
- 権限文言の例：「ぬいぐるみと背景を撮影するためにカメラを使用します」

## ビルドと起動

```bash
npx expo install expo-dev-client
npx expo run:android     # 初回は android/ を生成しGradleビルド、実機にインストール
npx expo start --dev-client   # 2回目以降のJS変更はこれで反映
```

- ネイティブ依存・`app.json` のプラグインを変更したら、`npx expo run:android` をやり直す。
- ビルドが壊れたときの最終手段：`npx expo prebuild --clean`。

## この段階の検証（M0の完了条件の一部）

1. アプリが実機で起動する。
2. カメラプレビューが表示される。
3. Skia の `<Canvas>` で簡単な図形が描画される。
4. `npx tsc --noEmit` がエラー0。

## やらないこと

- Expo Go での動作保証
- `android/` ディレクトリの手動編集（やむを得ない場合は `docs/DECISIONS.md` に理由を記録）
