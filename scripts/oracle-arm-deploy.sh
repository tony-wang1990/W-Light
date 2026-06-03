#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/tony-wang1990/W-Light.git}"
BRANCH="${BRANCH:-main}"
WEB_PORT="${WEB_PORT:-3005}"
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
Usage: oracle-arm-deploy.sh [options]

Options:
  --port PORT       Web port exposed on the server, default 3005
  --app-dir DIR     Install/update directory, default /root/W-Light for root
  --branch BRANCH   Git branch, default main
  --repo URL        Git repository URL
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      WEB_PORT="$2"
      shift 2
      ;;
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --repo)
      REPO_URL="$2"
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

if ! [[ "$WEB_PORT" =~ ^[0-9]+$ ]] || (( WEB_PORT < 1 || WEB_PORT > 65535 )); then
  echo "Invalid --port value: $WEB_PORT" >&2
  exit 1
fi

SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
fi

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update
    $SUDO apt-get install -y ca-certificates curl git openssl
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO systemctl enable --now docker || true
}

update_repo() {
  if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" fetch origin "$BRANCH"
    git -C "$APP_DIR" checkout "$BRANCH"
    git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
  else
    $SUDO mkdir -p "$(dirname "$APP_DIR")"
    if [[ "$SUDO" == "sudo" ]]; then
      $SUDO chown -R "$(id -u):$(id -g)" "$(dirname "$APP_DIR")"
    fi
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
}

random_hex() {
  openssl rand -hex "$1"
}

env_value() {
  local key="$1"
  if [[ -f .env ]]; then
    grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true
  fi
}

set_env() {
  local key="$1"
  local value="$2"
  touch .env
  if grep -qE "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

ensure_env() {
  cd "$APP_DIR"

  local db_password
  local redis_password
  local jwt_secret
  local minio_user
  local minio_password

  db_password="$(env_value DB_PASSWORD)"
  redis_password="$(env_value REDIS_PASSWORD)"
  jwt_secret="$(env_value JWT_SECRET)"
  minio_user="$(env_value MINIO_USER)"
  minio_password="$(env_value MINIO_PASSWORD)"

  set_env WEB_PORT "$WEB_PORT"
  set_env TZ "Asia/Shanghai"
  set_env ORDER_NO_TIME_ZONE "Asia/Shanghai"
  set_env DB_NAME "$(env_value DB_NAME || true)"
  set_env DB_USER "$(env_value DB_USER || true)"
  set_env DB_PASSWORD "${db_password:-$(random_hex 24)}"
  set_env DB_SYNCHRONIZE "false"
  set_env DB_MIGRATIONS_RUN "true"
  set_env DB_SSL "false"
  set_env REDIS_PASSWORD "${redis_password:-$(random_hex 24)}"
  set_env JWT_SECRET "${jwt_secret:-$(random_hex 48)}"
  set_env JWT_EXPIRES_IN "7d"
  set_env MINIO_USER "${minio_user:-lightopsadmin}"
  set_env MINIO_PASSWORD "${minio_password:-$(random_hex 24)}"
  set_env MINIO_BUCKET "lightops-files"

  if [[ -z "$(env_value DB_NAME)" ]]; then set_env DB_NAME "lightops"; fi
  if [[ -z "$(env_value DB_USER)" ]]; then set_env DB_USER "lightops"; fi
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -qi active; then
    $SUDO ufw allow "${WEB_PORT}/tcp"
  fi
}

compose() {
  if docker ps >/dev/null 2>&1; then
    docker compose "$@"
  else
    $SUDO docker compose "$@"
  fi
}

deploy_stack() {
  cd "$APP_DIR"
  compose build --pull
  compose up -d --remove-orphans
  compose ps

  echo
  echo "W-Light deployed."
  echo "Web:  http://SERVER_IP:${WEB_PORT}"
  echo "API:  http://SERVER_IP:${WEB_PORT}/v1"
  echo
  echo "If Oracle Cloud still cannot open the page, also allow TCP ${WEB_PORT} in the OCI Security List / NSG."
}

install_packages
install_docker
update_repo
ensure_env
open_firewall
deploy_stack
