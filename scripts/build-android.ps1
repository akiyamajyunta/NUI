# ローカル Android ビルド（Cursor サンドボックスの長い Gradle パスを避ける）
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path "C:\gradle-home", "C:\tmp-build" | Out-Null
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "C:\gradle-home"
$env:TMP = "C:\tmp-build"
$env:TEMP = "C:\tmp-build"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:Path"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\android"
& .\gradlew.bat -g C:\gradle-home assembleDebug @args