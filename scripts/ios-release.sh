#!/usr/bin/env bash
set -euo pipefail

PUBLISH_WEB=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish-web)
      PUBLISH_WEB=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS release builds must run on macOS with Xcode installed." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="${ROOT_DIR}/apps/LightOps/ios"
BUILD_DIR="${IOS_DIR}/build"
SCHEME="${IOS_SCHEME:-LightOps}"
CONFIGURATION="${IOS_CONFIGURATION:-Release}"
EXPORT_METHOD="${IOS_EXPORT_METHOD:-ad-hoc}"
ARCHIVE_PATH="${BUILD_DIR}/${SCHEME}.xcarchive"
EXPORT_PATH="${BUILD_DIR}/export"
DOWNLOAD_DIR="${ROOT_DIR}/deploy/downloads"

command -v xcodebuild >/dev/null 2>&1 || {
  echo "xcodebuild is required. Install Xcode and run xcode-select first." >&2
  exit 1
}

command -v pod >/dev/null 2>&1 || {
  echo "CocoaPods is required. Install it with: sudo gem install cocoapods" >&2
  exit 1
}

cd "${ROOT_DIR}"
corepack pnpm install --frozen-lockfile
corepack pnpm --filter LightOps exec tsc --noEmit

cd "${IOS_DIR}"
pod install

mkdir -p "${BUILD_DIR}" "${EXPORT_PATH}"

if [[ -n "${IOS_EXPORT_OPTIONS:-}" ]]; then
  EXPORT_OPTIONS="${IOS_EXPORT_OPTIONS}"
else
  EXPORT_OPTIONS="${BUILD_DIR}/ExportOptions.plist"
  cat > "${EXPORT_OPTIONS}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${EXPORT_METHOD}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>
PLIST
fi

BUILD_TARGET=(-project "LightOps.xcodeproj")
if [[ -d "LightOps.xcworkspace" ]]; then
  BUILD_TARGET=(-workspace "LightOps.xcworkspace")
fi

xcodebuild \
  "${BUILD_TARGET[@]}" \
  -scheme "${SCHEME}" \
  -configuration "${CONFIGURATION}" \
  -destination "generic/platform=iOS" \
  -archivePath "${ARCHIVE_PATH}" \
  clean archive

xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportPath "${EXPORT_PATH}" \
  -exportOptionsPlist "${EXPORT_OPTIONS}"

IPA_PATH="$(find "${EXPORT_PATH}" -maxdepth 1 -name '*.ipa' -print -quit)"
if [[ -z "${IPA_PATH}" ]]; then
  echo "IPA was not generated in ${EXPORT_PATH}" >&2
  exit 1
fi

echo "iOS IPA: ${IPA_PATH}"

if [[ "${PUBLISH_WEB}" -eq 1 ]]; then
  mkdir -p "${DOWNLOAD_DIR}"
  cp "${IPA_PATH}" "${DOWNLOAD_DIR}/w-light-ios-latest.ipa"
  shasum -a 256 "${DOWNLOAD_DIR}/w-light-ios-latest.ipa" | awk '{print $1 "  w-light-ios-latest.ipa"}' > "${DOWNLOAD_DIR}/w-light-ios-latest.ipa.sha256"

  COMMIT="unknown"
  if command -v git >/dev/null 2>&1; then
    COMMIT="$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  fi

  cat > "${DOWNLOAD_DIR}/w-light-ios.json" <<JSON
{
  "platform": "ios",
  "file": "w-light-ios-latest.ipa",
  "builtAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "commit": "${COMMIT}",
  "exportMethod": "${EXPORT_METHOD}"
}
JSON
  echo "Published ${DOWNLOAD_DIR}/w-light-ios-latest.ipa"
fi
