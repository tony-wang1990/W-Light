#!/usr/bin/env bash
set -Eeuo pipefail

BRANCH="${BRANCH:-main}"
WEB_PORT="${WEB_PORT:-}"
HEALTH_RETRIES="${HEALTH_RETRIES:-24}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
SKIP_BACKUP=false
AUTO_ROLLBACK=true
DEFAULT_APP_DIR="/root/W-Light"

if [[ "$(id -u)" -ne 0 ]]; then
  DEFAULT_APP_DIR="${HOME}/W-Light"
fi

if [[ -z "${APP_DIR:-}" && -d .git && -f docker-compose.yml ]]; then
  APP_DIR="$(pwd)"
else
  APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
fi

usage() {
  cat <<'USAGE'
Usage: scripts/server-upgrade.sh [options]

Production upgrade flow:
  1. Verify the tracked git working tree is clean
  2. Create a PostgreSQL + MinIO + .env backup
  3. Pull the target branch with --ff-only
  4. Rebuild and restart API/Web containers
  5. Wait for /v1/health
  6. Roll back application code to the previous commit if health fails

Options:
  --app-dir DIR       App directory, default /root/W-Light for root
  --branch BRANCH     Git branch to upgrade, default main
  --port PORT         Web port, default from .env WEB_PORT or 3005
  --retries N         Health check attempts, default 24
  --interval SEC      Seconds between health attempts, default 5
  --skip-backup       Skip the pre-upgrade backup
  --no-rollback       Do not auto-roll back application code on failed health
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --port)
      WEB_PORT="$2"
      shift 2
      ;;
    --retries)
      HEALTH_RETRIES="$2"
      shift 2
      ;;
    --interval)
      HEALTH_INTERVAL="$2"
      shift 2
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --no-rollback)
      AUTO_ROLLBACK=false
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

if ! [[ "$HEALTH_RETRIES" =~ ^[0-9]+$ ]] || (( HEALTH_RETRIES < 1 )); then
  echo "Invalid --retries value: $HEALTH_RETRIES" >&2
  exit 1
fi

if ! [[ "$HEALTH_INTERVAL" =~ ^[0-9]+$ ]] || (( HEALTH_INTERVAL < 1 )); then
  echo "Invalid --interval value: $HEALTH_INTERVAL" >&2
  exit 1
fi

cd "$APP_DIR"

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

HEALTH_URL="http://127.0.0.1:${WEB_PORT}/v1/health"
OLD_COMMIT="$(git rev-parse HEAD)"
OLD_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)"
BACKUP_DIR=""

run() {
  echo "+ $*"
  "$@"
}

ensure_clean_tree() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Tracked working tree has local changes. Commit, stash or discard them before upgrading." >&2
    exit 1
  fi
}

latest_backup_dir() {
  find "${APP_DIR}/deploy/backups" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -n 1 || true
}

backup_before_upgrade() {
  if [[ "$SKIP_BACKUP" == "true" ]]; then
    echo "Skipped pre-upgrade backup."
    return 0
  fi

  run bash scripts/server-backup.sh || return 1
  BACKUP_DIR="$(latest_backup_dir)"
  echo "Pre-upgrade backup: ${BACKUP_DIR:-unknown}"
}

wait_health() {
  local attempt
  for (( attempt = 1; attempt <= HEALTH_RETRIES; attempt++ )); do
    if command -v curl >/dev/null 2>&1 && curl -fsS "$HEALTH_URL" >/dev/null; then
      echo "Health check passed: ${HEALTH_URL}"
      return 0
    fi
    echo "Health check ${attempt}/${HEALTH_RETRIES} failed, retrying in ${HEALTH_INTERVAL}s..."
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

build_and_restart() {
  run compose config >/dev/null || return 1
  COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1 COMPOSE_PARALLEL_LIMIT=1 compose build api web || return 1
  COMPOSE_PARALLEL_LIMIT=1 compose up -d --remove-orphans || return 1
  wait_health || return 1
}

upgrade() {
  ensure_clean_tree
  backup_before_upgrade || return 1
  run git fetch origin "$BRANCH" || return 1
  run git checkout "$BRANCH" || return 1
  run git pull --ff-only origin "$BRANCH" || return 1
  echo "Upgrading from ${OLD_COMMIT:0:12} to $(git rev-parse --short HEAD)"
  build_and_restart || return 1
}

rollback_app_code() {
  if [[ "$AUTO_ROLLBACK" != "true" ]]; then
    echo "Auto rollback disabled."
    return
  fi

  if [[ "$(git rev-parse HEAD)" == "$OLD_COMMIT" ]]; then
    echo "No application code change detected, rollback is not needed."
    return
  fi

  echo "Rolling application code back to ${OLD_COMMIT:0:12} from branch ${OLD_BRANCH}."
  git checkout "$OLD_COMMIT" || true
  if ! build_and_restart; then
    echo "Rollback build or health check failed. Inspect logs with scripts/server-health.sh." >&2
    return 1
  fi
  echo "Application code rolled back to ${OLD_COMMIT:0:12}."
}

echo "W-Light upgrade starting."
echo "App directory: ${APP_DIR}"
echo "Branch: ${BRANCH}"
echo "Current commit: ${OLD_COMMIT:0:12}"
echo "Health URL: ${HEALTH_URL}"

if upgrade; then
  echo "Upgrade completed successfully: $(git rev-parse --short HEAD)"
  exit 0
fi

echo "Upgrade failed." >&2
if [[ -n "$BACKUP_DIR" ]]; then
  echo "Pre-upgrade backup is available at: ${BACKUP_DIR}" >&2
fi

rollback_app_code
exit 1
