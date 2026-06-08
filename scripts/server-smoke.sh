#!/usr/bin/env bash
set -Eeuo pipefail

DEFAULT_APP_DIR="/root/W-Light"
if [[ "$(id -u)" -ne 0 ]]; then
  DEFAULT_APP_DIR="${HOME}/W-Light"
fi

if [[ -z "${APP_DIR:-}" && -f docker-compose.yml ]]; then
  APP_DIR="$(pwd)"
else
  APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
fi

WEB_PORT="${WEB_PORT:-}"
BASE_URL="${BASE_URL:-}"
API_URL="${API_URL:-}"
ADMIN_PHONE="${ADMIN_PHONE:-13800000001}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-WLight@2026}"
PROJECT_ID="${PROJECT_ID:-}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-10}"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/server-smoke.sh [options]

Runs a post-deploy smoke test against a W-Light server:
  - Web root and client download page
  - API /health
  - Admin login
  - Project resolution
  - Key authenticated APIs used by the Web menus

Options:
  --app-dir DIR       App directory, default /root/W-Light for root
  --port PORT         Web port, default from .env WEB_PORT or 3005
  --base-url URL      Web base URL, default http://127.0.0.1:PORT
  --api-url URL       API base URL, default BASE_URL/v1
  --phone PHONE       Login phone, default 13800000001
  --password PASS     Login password, default WLight@2026
  --project-id ID     Project id to test; default first project returned by /projects
  --timeout N         curl timeout seconds, default 10

Examples:
  bash scripts/server-smoke.sh --port 3005
  bash scripts/server-smoke.sh --base-url http://161.153.60.163:3005 --phone 13800000001 --password 'your-password'
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --port)
      WEB_PORT="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    --phone)
      ADMIN_PHONE="$2"
      shift 2
      ;;
    --password)
      ADMIN_PASSWORD="$2"
      shift 2
      ;;
    --project-id)
      PROJECT_ID="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="$2"
      shift 2
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

if ! [[ "$TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || (( TIMEOUT_SECONDS < 1 )); then
  echo "Invalid --timeout value: ${TIMEOUT_SECONDS}" >&2
  exit 1
fi

cd "$APP_DIR"

env_value() {
  local key="$1"
  if [[ -f .env ]]; then
    grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true
  fi
}

if [[ -z "$WEB_PORT" ]]; then
  WEB_PORT="$(env_value WEB_PORT)"
  WEB_PORT="${WEB_PORT:-3005}"
fi

BASE_URL="${BASE_URL:-http://127.0.0.1:${WEB_PORT}}"
BASE_URL="${BASE_URL%/}"
API_URL="${API_URL:-${BASE_URL}/v1}"
API_URL="${API_URL%/}"

SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
fi

compose() {
  if docker ps >/dev/null 2>&1; then
    docker compose "$@"
  else
    $SUDO docker compose "$@"
  fi
}

section() {
  echo
  echo "== $1 =="
}

ok() {
  echo "OK: $*"
}

fail() {
  echo "FAIL: $*" >&2
  status=1
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

json_pick() {
  local expr="$1"
  local script
  script="let raw='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>raw+=c);process.stdin.on('end',()=>{const data=JSON.parse(raw);const value=(${expr});if(value===undefined||value===null||value===''){process.exit(2)};if(typeof value==='object'){console.log(JSON.stringify(value))}else{console.log(String(value))}});"

  if command -v node >/dev/null 2>&1; then
    node -e "$script"
  else
    compose exec -T api node -e "$script"
  fi
}

curl_request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local -a args=(-fsS --max-time "$TIMEOUT_SECONDS" -X "$method" -H 'Accept: application/json')

  if [[ -n "${TOKEN:-}" ]]; then
    args+=(-H "Authorization: Bearer ${TOKEN}")
  fi
  if [[ -n "${PROJECT_ID:-}" ]]; then
    args+=(-H "X-Project-Id: ${PROJECT_ID}")
  fi
  if [[ -n "$body" ]]; then
    args+=(-H 'Content-Type: application/json' --data "$body")
  fi

  curl "${args[@]}" "$url"
}

check_plain() {
  local title="$1"
  local url="$2"
  section "$title"
  if curl -fsS --max-time "$TIMEOUT_SECONDS" "$url" >/dev/null; then
    ok "$url"
  else
    fail "$url"
  fi
}

check_json() {
  local title="$1"
  local path="$2"
  section "$title"
  if curl_request GET "${API_URL}${path}" >/dev/null; then
    ok "${API_URL}${path}"
  else
    fail "${API_URL}${path}"
  fi
}

status=0

section "W-Light post-deploy smoke"
echo "App directory: ${APP_DIR}"
echo "Base URL: ${BASE_URL}"
echo "API URL: ${API_URL}"
echo "Login phone: ${ADMIN_PHONE}"
echo "Git commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

check_plain "Web root" "${BASE_URL}/"
check_plain "Client download page" "${BASE_URL}/clients"
check_json "API health" "/health"

section "Login"
login_body="{\"phone\":\"$(json_escape "$ADMIN_PHONE")\",\"password\":\"$(json_escape "$ADMIN_PASSWORD")\"}"
if login_response="$(curl_request POST "${API_URL}/auth/login" "$login_body")"; then
  if TOKEN="$(printf '%s' "$login_response" | json_pick 'data.accessToken || data.token')"; then
    ok "login succeeded"
  else
    fail "login succeeded but response did not include an access token"
  fi
else
  fail "login failed; run scripts/server-admin.sh or check credentials"
fi

if [[ -n "${TOKEN:-}" ]]; then
  section "Projects"
  if projects_response="$(curl_request GET "${API_URL}/projects")"; then
    if [[ -z "$PROJECT_ID" ]]; then
      if ! PROJECT_ID="$(printf '%s' "$projects_response" | json_pick 'Array.isArray(data) ? data[0]?.id : data.items?.[0]?.id')"; then
        fail "project list succeeded but no project id was returned"
      fi
    fi
    if [[ -n "$PROJECT_ID" ]]; then
      ok "project id ${PROJECT_ID}"
    fi
  else
    fail "project list failed"
  fi
fi

if [[ -n "${TOKEN:-}" && -n "${PROJECT_ID:-}" ]]; then
  check_json "Orders API" "/orders?pageSize=1"
  check_json "Devices API" "/devices?pageSize=1"
  check_json "Parts API" "/parts?pageSize=1"
  check_json "Inspections stats API" "/inspections/stats"
  check_json "Reports summary API" "/reports/operations-summary"
  check_json "Users API" "/users?pageSize=1"
fi

section "Result"
if [[ "$status" -eq 0 ]]; then
  echo "W-Light smoke test passed."
else
  echo "W-Light smoke test failed. Check docker compose logs --tail=120 api web." >&2
fi

exit "$status"
