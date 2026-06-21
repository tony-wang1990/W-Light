param(
  [switch]$PublishWeb,
  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
  }
}

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$AndroidDir = Join-Path $RootDir "apps/LightOps/android"
$ApkPath = Join-Path $AndroidDir "app/build/outputs/apk/release/app-release.apk"
$DownloadDir = Join-Path $RootDir "deploy/downloads"
$AppVersion = if ($env:W_LIGHT_RELEASE_VERSION) {
  $env:W_LIGHT_RELEASE_VERSION
} else {
  ((Get-Content -LiteralPath (Join-Path $RootDir "package.json") -Raw) | ConvertFrom-Json).version
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java is required. Install JDK 17 and set JAVA_HOME before building Android."
}

$sdkCandidates = @(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
  "C:\Android\Sdk"
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $env:ANDROID_HOME -and $sdkCandidates.Count -gt 0) {
  $env:ANDROID_HOME = $sdkCandidates[0]
}
if (-not $env:ANDROID_SDK_ROOT -and $env:ANDROID_HOME) {
  $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
}
if (-not $env:ANDROID_HOME) {
  throw "Android SDK is required. Set ANDROID_HOME or install it under %LOCALAPPDATA%\Android\Sdk."
}

Set-Location $RootDir

if (-not $SkipChecks) {
  Invoke-Checked corepack pnpm install --frozen-lockfile
  Invoke-Checked corepack pnpm --filter LightOps exec tsc --noEmit
  Invoke-Checked corepack pnpm --filter LightOps run lint
}

Set-Location $AndroidDir
Invoke-Checked ".\gradlew.bat" assembleRelease

if (-not (Test-Path $ApkPath)) {
  throw "APK not found at $ApkPath"
}

if ($PublishWeb) {
  Invoke-Checked node (Join-Path $RootDir "scripts/publish-client-artifact.mjs") `
    --target android `
    --file $ApkPath `
    --downloads-dir $DownloadDir `
    --version $AppVersion
}

Write-Host "Android release APK: $ApkPath"
