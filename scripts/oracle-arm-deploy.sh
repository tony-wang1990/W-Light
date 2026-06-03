#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_SCRIPT="${SCRIPT_DIR}/server-deploy.sh"

if [[ -f "$LOCAL_SCRIPT" ]]; then
  exec "$LOCAL_SCRIPT" "$@"
fi

curl -fsSL https://raw.githubusercontent.com/tony-wang1990/W-Light/main/scripts/server-deploy.sh | bash -s -- "$@"
