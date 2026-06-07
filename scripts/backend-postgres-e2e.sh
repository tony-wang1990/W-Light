#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.e2e.yml"
PROJECT_NAME="${PROJECT_NAME:-w-light-e2e}"
POSTGRES_E2E_PORT="${POSTGRES_E2E_PORT:-55432}"
DB_NAME="${DB_NAME:-lightops_e2e}"
DB_USER="${DB_USER:-lightops_e2e}"
DB_PASSWORD="${DB_PASSWORD:-lightops_e2e_pwd}"
JWT_SECRET="${JWT_SECRET:-test_jwt_secret_for_lightops_postgres_e2e_at_least_32_chars}"
KEEP_CONTAINERS=0

usage() {
  cat <<'EOF'
Usage: scripts/backend-postgres-e2e.sh [--keep]

Starts a disposable PostgreSQL container, runs the backend App HTTP e2e suite
against it, and removes the container and volume afterwards.

Environment overrides:
  POSTGRES_E2E_PORT  Host port for PostgreSQL, default 55432
  DB_NAME            Test database name, default lightops_e2e
  DB_USER            Test database user, default lightops_e2e
  DB_PASSWORD        Test database password, default lightops_e2e_pwd
  PROJECT_NAME       Docker Compose project name, default w-light-e2e
EOF
}

for arg in "$@"; do
  case "$arg" in
    --keep)
      KEEP_CONTAINERS=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run PostgreSQL e2e tests." >&2
  exit 1
fi

if ! command -v corepack >/dev/null 2>&1; then
  echo "corepack is required to run pnpm." >&2
  exit 1
fi

export POSTGRES_E2E_PORT DB_NAME DB_USER DB_PASSWORD

COMPOSE=(docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE")

cleanup() {
  if [ "$KEEP_CONTAINERS" -eq 0 ]; then
    "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

"${COMPOSE[@]}" up -d postgres

echo "Waiting for PostgreSQL on 127.0.0.1:$POSTGRES_E2E_PORT ..."
ready=0
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "PostgreSQL did not become ready in time." >&2
  "${COMPOSE[@]}" logs postgres >&2 || true
  exit 1
fi

(
  cd "$ROOT_DIR/services/backend"
  E2E_DB_TYPE=postgres \
  DB_HOST=127.0.0.1 \
  DB_PORT="$POSTGRES_E2E_PORT" \
  DB_NAME="$DB_NAME" \
  DB_USER="$DB_USER" \
  DB_PASSWORD="$DB_PASSWORD" \
  DB_SYNCHRONIZE=true \
  DB_MIGRATIONS_RUN=false \
  DB_LOGGING=false \
  JWT_SECRET="$JWT_SECRET" \
  corepack pnpm exec jest src/app.e2e.spec.ts --runInBand
)

echo "PostgreSQL e2e tests passed."
