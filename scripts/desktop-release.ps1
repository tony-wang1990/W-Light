param(
  [ValidateSet('win', 'mac', 'linux', 'current')]
  [string]$Target = 'win',
  [switch]$PublishWeb
)

$ErrorActionPreference = 'Stop'
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$appVersion = if ($env:W_LIGHT_RELEASE_VERSION) {
  $env:W_LIGHT_RELEASE_VERSION
} else {
  ((Get-Content -LiteralPath (Join-Path (Get-Location) 'package.json') -Raw) | ConvertFrom-Json).version
}

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

if ($PublishWeb -and $Target -eq 'current') {
  throw "PublishWeb requires an explicit -Target win, mac, or linux."
}

$pattern = switch ($Target) {
  'win' { '*.exe' }
  'mac' { '*.dmg' }
  'linux' { '*.AppImage' }
  default { '*' }
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

$artifact = Get-ChildItem -Path 'apps\desktop\dist' -Filter $pattern -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $artifact) {
  throw "No desktop artifact matched $pattern in apps\desktop\dist"
}

Invoke-Checked node (Join-Path (Get-Location) 'scripts\publish-client-artifact.mjs') `
  --target $Target `
  --file $artifact.FullName `
  --downloads-dir $downloadsDir `
  --version $appVersion
