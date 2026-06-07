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
API_URL="${API_URL:-}"
LOG_LINES="${LOG_LINES:-80}"

usage() {
  cat <<'USAGE'
Usage: scripts/server-health.sh [options]

Checks the W-Light production deployment:
  - Git version and Docker Compose service status
  - Web/API health endpoint
  - Disk, memory and Docker container usage
  - Recent API/Web logs
  - Available server backups

Options:
  --app-dir DIR    App directory, default /root/W-Light for root
  --port PORT      Web port, default from .env WEB_PORT or 3005
  --api-url URL    Health base URL, default http://127.0.0.1:PORT/v1
  --logs N         Log lines for API/Web, default 80
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
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    --logs)
      LOG_LINES="$2"
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

if ! [[ "$LOG_LINES" =~ ^[0-9]+$ ]] || (( LOG_LINES < 1 )); then
  echo "Invalid --logs value: $LOG_LINES" >&2
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

if [[ -z "$API_URL" ]]; then
  API_URL="http://127.0.0.1:${WEB_PORT}/v1"
fi

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

warn() {
  echo "WARN: $*" >&2
}

status=0

check() {
  local title="$1"
  shift
  section "$title"
  if ! "$@"; then
    warn "${title} failed"
    status=1
  fi
}

print_version() {
  echo "App directory: ${APP_DIR}"
  echo "Git branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  echo "Git commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "Web port: ${WEB_PORT}"
  echo "API URL: ${API_URL}"
}

check_compose() {
  compose ps
}

check_health() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl not found, skipped HTTP health check."
    return 1
  fi
  curl -fsS "${API_URL}/health"
  echo
}

check_resources() {
  echo "-- disk --"
  df -h "$APP_DIR" || true
  echo
  echo "-- memory --"
  free -h || true
  echo
  echo "-- docker stats --"
  docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}' 2>/dev/null || true
}

show_logs() {
  compose logs --tail "$LOG_LINES" api web
}

show_backups() {
  bash scripts/server-backup.sh --list
}

section "W-Light server health"
print_version
check "Docker Compose services" check_compose
check "API health" check_health
section "Resources"
check_resources
section "Recent API/Web logs"
show_logs || warn "Could not read API/Web logs"
section "Backups"
show_backups || warn "Could not list backups"

exit "$status"
