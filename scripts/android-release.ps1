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
$AppVersion = ((Get-Content -LiteralPath (Join-Path $RootDir "package.json") -Raw) | ConvertFrom-Json).version

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java is required. Install JDK 17 and set JAVA_HOME before building Android."
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
  New-Item -ItemType Directory -Force -Path $DownloadDir | Out-Null
  $TargetApk = Join-Path $DownloadDir "w-light-latest.apk"
  Copy-Item $ApkPath $TargetApk -Force

  $Hash = Get-FileHash $TargetApk -Algorithm SHA256
  Set-Content -Path (Join-Path $DownloadDir "w-light-latest.apk.sha256") -Value "$($Hash.Hash.ToLower())  w-light-latest.apk"

  $Commit = "unknown"
  try {
    $Commit = (git -C $RootDir rev-parse --short HEAD).Trim()
  } catch {}

  $Meta = [ordered]@{
    platform = "android"
    file = "w-light-latest.apk"
    version = $AppVersion
    builtAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    commit = $Commit
    sha256 = $Hash.Hash.ToLower()
    sizeBytes = (Get-Item -LiteralPath $TargetApk).Length
  }
  $Meta | ConvertTo-Json | Set-Content -Path (Join-Path $DownloadDir "w-light-android.json")

  Write-Host "Published APK to $TargetApk"
}

Write-Host "Android release APK: $ApkPath"
