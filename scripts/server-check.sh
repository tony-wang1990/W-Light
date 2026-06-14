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

WEB_PORT="${WEB_PORT:-3005}"
BACKUP_ROOT=""
STRICT_DOWNLOADS=false
PUBLIC_URL="${PUBLIC_URL:-}"
MAX_DISK_WARN="${MAX_DISK_WARN:-85}"
MAX_DISK_FAIL="${MAX_DISK_FAIL:-95}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-48}"

usage() {
  cat <<'USAGE'
Usage: scripts/server-check.sh [options]

Production readiness checks for a deployed W-Light server:
  - Docker Compose services
  - Web and API health endpoints
  - PostgreSQL and Redis connectivity
  - client download artifacts and checksums
  - local backup directory status
  - production environment basics and disk capacity

Options:
  --app-dir DIR       App directory, default /root/W-Light for root
  --port PORT         Web port, default WEB_PORT or 3005
  --public-url URL    Optional public HTTPS URL, for example https://w-light.example.com
  --backup-root DIR   Backup root, default APP_DIR/deploy/backups
  --strict-downloads  Require Android APK and Windows EXE artifacts
  MAX_BACKUP_AGE_HOURS can be set in the environment, default 48
  -h, --help          Show help
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
    --public-url)
      PUBLIC_URL="$2"
      shift 2
      ;;
    --backup-root)
      BACKUP_ROOT="$2"
      shift 2
      ;;
    --strict-downloads)
      STRICT_DOWNLOADS=true
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

BACKUP_ROOT="${BACKUP_ROOT:-${APP_DIR}/deploy/backups}"

PASS=0
WARN=0
FAIL=0

ok() {
  PASS=$((PASS + 1))
  printf 'OK   %s\n' "$1"
}

warn() {
  WARN=$((WARN + 1))
  printf 'WARN %s\n' "$1"
}

fail() {
  FAIL=$((FAIL + 1))
  printf 'FAIL %s\n' "$1"
}

have() {
  command -v "$1" >/dev/null 2>&1
}

compose() {
  if docker ps >/dev/null 2>&1; then
    docker compose "$@"
  else
    sudo docker compose "$@"
  fi
}

load_env() {
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
    WEB_PORT="${WEB_PORT:-3005}"
    ok ".env loaded"
  else
    warn ".env not found; docker compose may fail if required secrets are missing"
  fi
}

is_unsafe_secret() {
  local value="${1:-}"
  local min_length="${2:-16}"

  if [[ -z "$value" || "${#value}" -lt "$min_length" ]]; then
    return 0
  fi

  case "${value,,}" in
    *change*|*example*|*password*|*123456*|*test*|*dev*|minioadmin|redis_dev_pwd|lightops_dev_pwd)
      return 0
      ;;
  esac

  return 1
}

check_env_security() {
  if [[ "${NODE_ENV:-}" == "production" ]]; then
    ok "NODE_ENV=production"
  else
    warn "NODE_ENV is '${NODE_ENV:-unset}'; set NODE_ENV=production for trial production"
  fi

  if [[ "${DB_SYNCHRONIZE:-false}" == "true" ]]; then
    fail "DB_SYNCHRONIZE=true is unsafe for production; use migrations instead"
  else
    ok "DB_SYNCHRONIZE is disabled"
  fi

  if [[ "${DB_MIGRATIONS_RUN:-}" == "true" ]]; then
    ok "DB_MIGRATIONS_RUN=true"
  else
    warn "DB_MIGRATIONS_RUN is not true; confirm migrations are run during upgrade"
  fi

  local secret_name
  for secret_name in JWT_SECRET DB_PASSWORD REDIS_PASSWORD MINIO_PASSWORD; do
    local value
    value="$(printenv "$secret_name" 2>/dev/null || true)"
    if is_unsafe_secret "$value" 16; then
      fail "${secret_name} is missing, too short, or still looks like a default"
    else
      ok "${secret_name} looks production-grade"
    fi
  done

  if [[ -z "${MINIO_USER:-}" || "${MINIO_USER:-}" == "minioadmin" ]]; then
    fail "MINIO_USER is missing or still minioadmin"
  else
    ok "MINIO_USER is customized"
  fi

  if [[ -n "${APP_ORIGINS:-${APP_ORIGIN:-}}" ]]; then
    ok "APP_ORIGINS/APP_ORIGIN configured"
  else
    warn "APP_ORIGINS is empty; same-origin Web works, but Android/Windows API calls may need explicit origins"
  fi

  if [[ "${ENABLE_SWAGGER:-false}" == "true" && "${NODE_ENV:-}" == "production" ]]; then
    warn "ENABLE_SWAGGER=true in production; turn it off after internal acceptance"
  fi
}

check_disk_space() {
  if ! have df; then
    warn "df not installed; skipped disk capacity check"
    return
  fi

  local used
  used="$(df -P "$APP_DIR" | awk 'NR==2 { gsub("%", "", $5); print $5 }')"
  if [[ -z "$used" || ! "$used" =~ ^[0-9]+$ ]]; then
    warn "could not read disk usage for $APP_DIR"
    return
  fi

  if (( used >= MAX_DISK_FAIL )); then
    fail "disk usage is ${used}% (>= ${MAX_DISK_FAIL}%)"
  elif (( used >= MAX_DISK_WARN )); then
    warn "disk usage is ${used}% (>= ${MAX_DISK_WARN}%)"
  else
    ok "disk usage is ${used}%"
  fi
}

check_http() {
  local label="$1"
  local url="$2"

  if have curl; then
    if curl -fsS --max-time 8 "$url" >/dev/null; then
      ok "$label reachable: $url"
    else
      fail "$label not reachable: $url"
    fi
  elif have wget; then
    if wget -qO- --timeout=8 "$url" >/dev/null; then
      ok "$label reachable: $url"
    else
      fail "$label not reachable: $url"
    fi
  else
    warn "curl/wget not installed; skipped $label HTTP check"
  fi
}

check_public_url() {
  if [[ -z "$PUBLIC_URL" ]]; then
    return
  fi

  PUBLIC_URL="${PUBLIC_URL%/}"
  if [[ "$PUBLIC_URL" == https://* ]]; then
    ok "public URL uses HTTPS: $PUBLIC_URL"
  else
    warn "public URL is not HTTPS: $PUBLIC_URL"
  fi

  check_http "Public Web" "${PUBLIC_URL}/"
  check_http "Public API readiness" "${PUBLIC_URL}/v1/health/ready"
  check_http "Public clients page" "${PUBLIC_URL}/clients"
}

check_compose_services() {
  if ! have docker; then
    fail "docker is not installed"
    return
  fi

  if compose ps >/tmp/wlight-compose-ps.txt 2>/tmp/wlight-compose-ps.err; then
    ok "docker compose ps succeeded"
  else
    fail "docker compose ps failed: $(tr '\n' ' ' </tmp/wlight-compose-ps.err)"
    return
  fi

  local services=(web api postgres redis minio)
  local service
  for service in "${services[@]}"; do
    if compose ps "$service" 2>/dev/null | grep -Eiq '(running|up|healthy)'; then
      ok "service ${service} is running"
    else
      fail "service ${service} is not running"
    fi
  done
}

check_postgres() {
  local user="${DB_USER:-lightops}"
  local db="${DB_NAME:-lightops}"

  if compose exec -T postgres pg_isready -U "$user" -d "$db" >/dev/null 2>&1; then
    ok "PostgreSQL accepts connections"
  else
    fail "PostgreSQL connection check failed"
    return
  fi

  if compose exec -T postgres psql -U "$user" -d "$db" -tAc "select count(*) from information_schema.tables where table_schema='public';" >/tmp/wlight-table-count.txt 2>/dev/null; then
    local count
    count="$(tr -d '[:space:]' </tmp/wlight-table-count.txt)"
    if [[ "${count:-0}" -gt 0 ]]; then
      ok "PostgreSQL has ${count} public tables"
    else
      fail "PostgreSQL has no public tables; migrations may not have run"
    fi
  else
    warn "Skipped PostgreSQL table count"
  fi
}

check_redis() {
  local password="${REDIS_PASSWORD:-}"
  if [[ -z "$password" ]]; then
    warn "REDIS_PASSWORD is empty; skipped redis-cli ping"
    return
  fi

  if compose exec -T redis redis-cli -a "$password" ping 2>/dev/null | grep -q PONG; then
    ok "Redis ping returned PONG"
  else
    fail "Redis ping failed"
  fi
}

check_downloads() {
  local downloads_dir="${APP_DIR}/deploy/downloads"
  if [[ ! -d "$downloads_dir" ]]; then
    fail "downloads directory missing: $downloads_dir"
    return
  fi

  if have node && [[ -f scripts/verify-downloads.mjs ]]; then
    local args=(scripts/verify-downloads.mjs --downloads-dir "$downloads_dir")
    if [[ "$STRICT_DOWNLOADS" == "true" ]]; then
      args+=(--strict)
    fi
    if node "${args[@]}" >/tmp/wlight-downloads-check.txt 2>/tmp/wlight-downloads-check.err; then
      ok "client download metadata/checksums verified"
    else
      fail "client download verification failed: $(tr '\n' ' ' </tmp/wlight-downloads-check.err)"
    fi
    return
  fi

  warn "node not found; using fallback download checksum checks"
  local required=()
  if [[ "$STRICT_DOWNLOADS" == "true" ]]; then
    required=(w-light-latest.apk W-Light-Setup-latest.exe)
  fi

  local artifact
  for artifact in "${required[@]}"; do
    if [[ -s "${downloads_dir}/${artifact}" ]]; then
      ok "download artifact exists: ${artifact}"
    else
      fail "download artifact missing: ${artifact}"
    fi
  done

  if have sha256sum; then
    local checksum
    for checksum in "${downloads_dir}"/*.sha256; do
      [[ -e "$checksum" ]] || continue
      if (cd "$downloads_dir" && sha256sum -c "$(basename "$checksum")" >/dev/null 2>&1); then
        ok "checksum verified: $(basename "$checksum")"
      else
        fail "checksum mismatch: $(basename "$checksum")"
      fi
    done
  else
    warn "sha256sum not installed; skipped fallback checksum verification"
  fi
}

metadata_commit() {
  local metadata_file="$1"

  if [[ ! -f "$metadata_file" ]]; then
    return 1
  fi

  if have node; then
    node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); if (!data.commit) process.exit(2); console.log(String(data.commit));" "$metadata_file"
    return
  fi

  grep -E '"commit"[[:space:]]*:' "$metadata_file" | head -n 1 | sed -E 's/.*"commit"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
}

check_client_source_commit() {
  local label="$1"
  local metadata_file="$2"

  if [[ ! -f "$metadata_file" ]]; then
    warn "${label} metadata missing: $metadata_file"
    return
  fi

  local commit
  commit="$(metadata_commit "$metadata_file" 2>/dev/null || true)"
  if [[ -z "$commit" || "$commit" == "unknown" ]]; then
    warn "${label} metadata has no usable git commit"
    return
  fi

  if ! have git || ! git rev-parse --git-dir >/dev/null 2>&1; then
    warn "git is not available; skipped ${label} source freshness check"
    return
  fi

  if ! git cat-file -e "${commit}^{commit}" 2>/dev/null; then
    warn "${label} package commit ${commit} is not present in local git history"
    return
  fi

  local head
  head="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  if [[ "$commit" == "$head" ]]; then
    ok "${label} package was built from current commit ${head}"
    return
  fi

  if git diff --quiet "$commit" -- apps packages package.json pnpm-lock.yaml; then
    ok "${label} package matches current client source (metadata commit ${commit})"
  else
    warn "${label} package was built from ${commit}, but client source changed by ${head}; wait for GitHub Actions or rebuild clients"
  fi
}

check_download_freshness() {
  local downloads_dir="${APP_DIR}/deploy/downloads"
  check_client_source_commit "Android" "${downloads_dir}/w-light-android.json"
  check_client_source_commit "Windows" "${downloads_dir}/w-light-desktop.json"
}

check_backups() {
  if [[ ! -d "$BACKUP_ROOT" ]]; then
    warn "backup root not found: $BACKUP_ROOT"
    return
  fi

  local latest
  latest="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -n 1 || true)"
  if [[ -z "$latest" ]]; then
    warn "no backup directories found in $BACKUP_ROOT"
    return
  fi

  ok "latest backup: $(basename "$latest")"
  if have date && have stat; then
    local backup_mtime
    local now
    local age_hours
    backup_mtime="$(stat -c %Y "$latest" 2>/dev/null || echo 0)"
    now="$(date +%s)"
    age_hours=$(( (now - backup_mtime) / 3600 ))
    if (( age_hours > MAX_BACKUP_AGE_HOURS )); then
      warn "latest backup is ${age_hours}h old (>${MAX_BACKUP_AGE_HOURS}h)"
    else
      ok "latest backup age is ${age_hours}h"
    fi
  fi
  if [[ -s "${latest}/postgres.sql" ]]; then
    ok "latest backup has PostgreSQL dump"
  else
    fail "latest backup missing postgres.sql"
  fi
  if [[ -s "${latest}/minio-data.tar.gz" ]]; then
    ok "latest backup has MinIO archive"
  else
    fail "latest backup missing minio-data.tar.gz"
  fi
  if [[ -f "${latest}/SHA256SUMS" ]] && have sha256sum; then
    if (cd "$latest" && sha256sum -c SHA256SUMS >/dev/null 2>&1); then
      ok "latest backup checksums verified"
    else
      fail "latest backup checksum verification failed"
    fi
  else
    warn "latest backup checksum manifest not verified"
  fi
}

main() {
  if [[ ! -d "$APP_DIR" ]]; then
    echo "App directory does not exist: $APP_DIR" >&2
    exit 1
  fi

  cd "$APP_DIR"
  echo "W-Light production check"
  echo "App dir: $APP_DIR"
  echo "Web port: $WEB_PORT"
  if [[ -n "$PUBLIC_URL" ]]; then
    echo "Public URL: $PUBLIC_URL"
  fi
  echo

  load_env
  check_env_security
  check_disk_space
  check_compose_services
  check_http "Web" "http://127.0.0.1:${WEB_PORT}/"
  check_http "API health" "http://127.0.0.1:${WEB_PORT}/v1/health"
  check_http "API readiness" "http://127.0.0.1:${WEB_PORT}/v1/health/ready"
  check_public_url
  check_postgres
  check_redis
  check_downloads
  check_download_freshness
  check_backups

  echo
  echo "Summary: ${PASS} passed, ${WARN} warnings, ${FAIL} failed"
  if [[ "$FAIL" -gt 0 ]]; then
    exit 1
  fi
}

main
