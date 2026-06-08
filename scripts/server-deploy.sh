#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/tony-wang1990/W-Light.git}"
BRANCH="${BRANCH:-main}"
WEB_PORT="${WEB_PORT:-3005}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
SWAP_FILE="${SWAP_FILE:-/swapfile-lightops}"
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
Usage: server-deploy.sh [options]

Deploy W-Light on Ubuntu/Debian servers, including ARM64 and AMD64 1C1G hosts.

Options:
  --port PORT       Web port exposed on the server, default 3005
  --app-dir DIR     Install/update directory, default /root/W-Light for root
  --branch BRANCH   Git branch, default main
  --repo URL        Git repository URL
  --swap-size SIZE  Swap file size for low-memory hosts, default 2G
  --no-swap         Do not create swap automatically
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
    --origins)
      APP_ORIGINS_ARG="$2"
      shift 2
      ;;
    --swap-size)
      SWAP_SIZE="$2"
      shift 2
      ;;
    --no-swap)
      SWAP_SIZE="0"
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

if ! [[ "$WEB_PORT" =~ ^[0-9]+$ ]] || (( WEB_PORT < 1 || WEB_PORT > 65535 )); then
  echo "Invalid --port value: $WEB_PORT" >&2
  exit 1
fi

SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  SUDO="sudo"
fi

arch_name() {
  uname -m
}

memory_mb() {
  awk '/MemTotal/ { printf "%d", $2 / 1024 }' /proc/meminfo 2>/dev/null || echo 0
}

swap_mb() {
  awk '/SwapTotal/ { printf "%d", $2 / 1024 }' /proc/meminfo 2>/dev/null || echo 0
}

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

ensure_swap() {
  if [[ "$SWAP_SIZE" == "0" ]]; then
    return
  fi

  local mem
  local swap
  mem="$(memory_mb)"
  swap="$(swap_mb)"

  if (( mem >= 1800 || swap >= 1024 )); then
    return
  fi

  echo "Low-memory server detected: ${mem}MB RAM, ${swap}MB swap. Creating ${SWAP_SIZE} swap at ${SWAP_FILE}."

  if [[ ! -f "$SWAP_FILE" ]]; then
    if command -v fallocate >/dev/null 2>&1; then
      $SUDO fallocate -l "$SWAP_SIZE" "$SWAP_FILE"
    else
      $SUDO dd if=/dev/zero of="$SWAP_FILE" bs=1M count=2048 status=progress
    fi
    $SUDO chmod 600 "$SWAP_FILE"
    $SUDO mkswap "$SWAP_FILE"
  fi

  if ! swapon --show=NAME | grep -qx "$SWAP_FILE"; then
    $SUDO swapon "$SWAP_FILE"
  fi

  if ! grep -qE "^${SWAP_FILE}[[:space:]]" /etc/fstab; then
    echo "${SWAP_FILE} none swap sw 0 0" | $SUDO tee -a /etc/fstab >/dev/null
  fi
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

set_env_default() {
  local key="$1"
  local value="$2"
  local current
  current="$(env_value "$key")"
  set_env "$key" "${current:-$value}"
}

ensure_env() {
  cd "$APP_DIR"

  local public_ip
  public_ip=$(curl -s ifconfig.me 2>/dev/null || echo "127.0.0.1")
  local default_origins="http://${public_ip},http://${public_ip}:${WEB_PORT}"
  
  if [[ -n "${APP_ORIGINS_ARG:-}" ]]; then
    default_origins="${APP_ORIGINS_ARG}"
  fi

  set_env WEB_PORT "$WEB_PORT"
  set_env_default TZ "Asia/Shanghai"
  set_env_default ORDER_NO_TIME_ZONE "Asia/Shanghai"
  set_env_default DB_NAME "lightops"
  set_env_default DB_USER "lightops"
  set_env_default DB_PASSWORD "$(random_hex 24)"
  set_env DB_SYNCHRONIZE "false"
  set_env_default DB_MIGRATIONS_RUN "true"
  set_env_default DB_SSL "false"
  set_env_default REDIS_PASSWORD "$(random_hex 24)"
  set_env_default JWT_SECRET "$(random_hex 48)"
  set_env_default JWT_EXPIRES_IN "7d"
  set_env_default APP_ORIGINS "$default_origins"
  set_env_default ENABLE_SWAGGER "false"
  set_env_default MINIO_USER "lightopsadmin"
  set_env_default MINIO_PASSWORD "$(random_hex 24)"
  set_env_default MINIO_BUCKET "lightops-files"

  set_env_default NODE_OPTIONS "--max-old-space-size=384"
  set_env_default REDIS_MAXMEMORY "128mb"
  set_env_default POSTGRES_MAX_CONNECTIONS "40"
  set_env_default POSTGRES_SHARED_BUFFERS "128MB"
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
  mkdir -p deploy/downloads

  echo "Server architecture: $(arch_name)"
  echo "Memory: $(memory_mb)MB RAM, $(swap_mb)MB swap"
  echo "App directory: $APP_DIR"

  compose config >/dev/null
  COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1 COMPOSE_PARALLEL_LIMIT=1 compose build --pull
  COMPOSE_PARALLEL_LIMIT=1 compose up -d --remove-orphans
  compose ps

  local current_origins
  current_origins="$(env_value "APP_ORIGINS")"
  
  echo
  echo "=============================================="
  echo "W-Light deployed successfully."
  echo "Web:  http://SERVER_IP:${WEB_PORT}"
  echo "API:  http://SERVER_IP:${WEB_PORT}/v1"
  echo "APK:  http://SERVER_IP:${WEB_PORT}/downloads/w-light-latest.apk"
  echo "=============================================="
  echo -e "\033[0;31m⚠️ CRITICAL SECURITY NOTICE\033[0m"
  echo "Strong random passwords have been automatically generated and saved to the .env file in ${APP_DIR}."
  echo "Please DO NOT commit the .env file to Git."
  echo "=============================================="
  echo "CORS Origins allowed: ${current_origins}"
  echo "If your domain is not listed here, edit the .env file and restart the API container."
  echo
  echo "If the page is still unreachable, also allow TCP ${WEB_PORT} in the cloud security list / NSG."
}

install_packages
install_docker
ensure_swap
update_repo
ensure_env
open_firewall
deploy_stack
