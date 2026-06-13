#!/usr/bin/env bash
set -euo pipefail

TARGET="current"
PUBLISH_WEB="0"
export CSC_IDENTITY_AUTO_DISCOVERY="false"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_VERSION="$(node -e "console.log(require('${ROOT_DIR}/package.json').version)" 2>/dev/null || echo unknown)"

for arg in "$@"; do
  case "$arg" in
    --win)
      TARGET="win"
      ;;
    --mac)
      TARGET="mac"
      ;;
    --linux)
      TARGET="linux"
      ;;
    --publish-web)
      PUBLISH_WEB="1"
      ;;
    --help|-h)
      cat <<'USAGE'
Usage: bash scripts/desktop-release.sh [--win|--mac|--linux] [--publish-web]

Examples:
  bash scripts/desktop-release.sh --win
  bash scripts/desktop-release.sh --mac --publish-web
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

SCRIPT="dist"
PATTERN="*"
LATEST_NAME=""

case "$TARGET" in
  win)
    SCRIPT="dist:win"
    PATTERN="*.exe"
    LATEST_NAME="W-Light-Setup-latest.exe"
    ;;
  mac)
    SCRIPT="dist:mac"
    PATTERN="*.dmg"
    LATEST_NAME="W-Light-latest.dmg"
    ;;
  linux)
    SCRIPT="dist:linux"
    PATTERN="*.AppImage"
    LATEST_NAME="W-Light-latest.AppImage"
    ;;
esac

corepack enable >/dev/null 2>&1 || true

if ! command -v pnpm >/dev/null 2>&1; then
  mkdir -p tmp/pnpm-shim
  cat > tmp/pnpm-shim/pnpm <<'SHIM'
#!/usr/bin/env bash
corepack pnpm "$@"
SHIM
  chmod +x tmp/pnpm-shim/pnpm
  export PATH="$PWD/tmp/pnpm-shim:$PATH"
fi

corepack pnpm --filter desktop run "$SCRIPT"

if [[ "$PUBLISH_WEB" != "1" ]]; then
  exit 0
fi

mkdir -p deploy/downloads

shopt -s nullglob
artifacts=(apps/desktop/dist/$PATTERN)
shopt -u nullglob
if [[ "${#artifacts[@]}" -eq 0 ]]; then
  echo "No desktop artifact matched $PATTERN in apps/desktop/dist"
  exit 1
fi

artifact="$(ls -t "${artifacts[@]}" | head -n 1)"
cp "$artifact" "deploy/downloads/$LATEST_NAME"

if command -v sha256sum >/dev/null 2>&1; then
  ARTIFACT_SHA="$(sha256sum "deploy/downloads/$LATEST_NAME" | awk '{print $1}')"
  echo "$ARTIFACT_SHA  $LATEST_NAME" > "deploy/downloads/$LATEST_NAME.sha256"
else
  ARTIFACT_SHA=""
fi
ARTIFACT_SIZE="$(wc -c < "deploy/downloads/$LATEST_NAME" | tr -d ' ')"

cat > deploy/downloads/w-light-desktop.json <<JSON
{
  "target": "$TARGET",
  "file": "$LATEST_NAME",
  "version": "$APP_VERSION",
  "sourceArtifact": "$(basename "$artifact")",
  "builtAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "commit": "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)",
  "sha256": "$ARTIFACT_SHA",
  "sizeBytes": $ARTIFACT_SIZE
}
JSON

echo "Published deploy/downloads/$LATEST_NAME"
