param(
  [ValidateSet('win', 'mac', 'linux', 'current')]
  [string]$Target = 'win',
  [switch]$PublishWeb
)

$ErrorActionPreference = 'Stop'
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$appVersion = ((Get-Content -LiteralPath (Join-Path (Get-Location) 'package.json') -Raw) | ConvertFrom-Json).version

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

$shimDir = Join-Path (Get-Location) 'tmp\pnpm-shim'
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  New-Item -ItemType Directory -Force -Path $shimDir | Out-Null
  $shimPath = Join-Path $shimDir 'pnpm.cmd'
  Set-Content -LiteralPath $shimPath -Value "@echo off`r`ncorepack pnpm %*" -Encoding ascii
  $env:PATH = "$shimDir;$env:PATH"
}

$scriptName = switch ($Target) {
  'win' { 'dist:win' }
  'mac' { 'dist:mac' }
  'linux' { 'dist:linux' }
  default { 'dist' }
}

$pattern = switch ($Target) {
  'win' { '*.exe' }
  'mac' { '*.dmg' }
  'linux' { '*.AppImage' }
  default { '*' }
}

$latestName = switch ($Target) {
  'win' { 'W-Light-Setup-latest.exe' }
  'mac' { 'W-Light-latest.dmg' }
  'linux' { 'W-Light-latest.AppImage' }
  default { 'W-Light-latest' }
}

try {
  & corepack enable | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "corepack enable failed; continuing because corepack pnpm can still run without global shims."
  }
} catch {
  Write-Warning "corepack enable failed; continuing because corepack pnpm can still run without global shims."
}

Invoke-Checked corepack pnpm --filter desktop run $scriptName

if (-not $PublishWeb) {
  exit 0
}

$downloadsDir = Join-Path (Get-Location) 'deploy\downloads'
New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null

$artifact = Get-ChildItem -Path 'apps\desktop\dist' -Filter $pattern -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $artifact) {
  throw "No desktop artifact matched $pattern in apps\desktop\dist"
}

$targetPath = Join-Path $downloadsDir $latestName
Copy-Item -LiteralPath $artifact.FullName -Destination $targetPath -Force

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath
Set-Content -LiteralPath "$targetPath.sha256" -Value $hash.Hash.ToLowerInvariant() -Encoding utf8

$metadata = [ordered]@{
  target = $Target
  file = $latestName
  version = $appVersion
  sourceArtifact = $artifact.Name
  builtAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  commit = "unknown"
  sha256 = $hash.Hash.ToLowerInvariant()
  sizeBytes = (Get-Item -LiteralPath $targetPath).Length
}

try {
  $metadata.commit = (git rev-parse --short HEAD).Trim()
} catch {}

$metadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $downloadsDir 'w-light-desktop.json') -Encoding utf8

Write-Host "Published $targetPath"
