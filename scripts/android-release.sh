#!/usr/bin/env bash
set -Eeuo pipefail

PUBLISH_WEB=0
SKIP_CHECKS=0

usage() {
  cat <<'USAGE'
Usage: android-release.sh [options]

Build the W-Light Android release APK.

Options:
  --publish-web   Copy the APK to deploy/downloads/w-light-latest.apk
  --skip-checks   Skip pnpm install, TypeScript, and lint checks
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish-web)
      PUBLISH_WEB=1
      shift
      ;;
    --skip-checks)
      SKIP_CHECKS=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="${ROOT_DIR}/apps/LightOps/android"
APK_PATH="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"
DOWNLOAD_DIR="${ROOT_DIR}/deploy/downloads"
APP_VERSION="$(node -e "console.log(require('${ROOT_DIR}/package.json').version)" 2>/dev/null || echo unknown)"

if ! command -v java >/dev/null 2>&1; then
  echo "Java is required. Install JDK 17 and set JAVA_HOME before building Android." >&2
  exit 1
fi

if [[ ! -x "${ANDROID_DIR}/gradlew" ]]; then
  chmod +x "${ANDROID_DIR}/gradlew"
fi

cd "$ROOT_DIR"

if [[ "$SKIP_CHECKS" -eq 0 ]]; then
  corepack pnpm install --frozen-lockfile
  corepack pnpm --filter LightOps exec tsc --noEmit
  corepack pnpm --filter LightOps run lint
fi

cd "$ANDROID_DIR"
./gradlew assembleRelease

if [[ ! -f "$APK_PATH" ]]; then
  echo "APK not found at $APK_PATH" >&2
  exit 1
fi

if [[ "$PUBLISH_WEB" -eq 1 ]]; then
  mkdir -p "$DOWNLOAD_DIR"
  cp "$APK_PATH" "${DOWNLOAD_DIR}/w-light-latest.apk"

  ARTIFACT_SHA=""
  if command -v sha256sum >/dev/null 2>&1; then
    ARTIFACT_SHA="$(sha256sum "${DOWNLOAD_DIR}/w-light-latest.apk" | awk '{print $1}')"
    echo "${ARTIFACT_SHA}  w-light-latest.apk" > "${DOWNLOAD_DIR}/w-light-latest.apk.sha256"
  fi
  ARTIFACT_SIZE="$(wc -c < "${DOWNLOAD_DIR}/w-light-latest.apk" | tr -d ' ')"

  cat > "${DOWNLOAD_DIR}/w-light-android.json" <<JSON
{
  "platform": "android",
  "file": "w-light-latest.apk",
  "version": "${APP_VERSION}",
  "builtAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "commit": "$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)",
  "sha256": "${ARTIFACT_SHA}",
  "sizeBytes": ${ARTIFACT_SIZE}
}
JSON

  echo "Published APK to ${DOWNLOAD_DIR}/w-light-latest.apk"
fi

echo "Android release APK: $APK_PATH"
