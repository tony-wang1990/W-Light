#!/usr/bin/env bash
set -Eeuo pipefail

DEFAULT_APP_DIR="/root/W-Light"
if [[ "$(id -u)" -ne 0 ]]; then
  DEFAULT_APP_DIR="${HOME}/W-Light"
fi

APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
ADMIN_PHONE="${ADMIN_PHONE:-13800000001}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-WLight@2026}"
ADMIN_NAME="${ADMIN_NAME:-System Admin}"
PROJECT_NAME="${PROJECT_NAME:-W-LightOps Sample Project}"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/server-admin.sh
  bash scripts/server-admin.sh --phone 13800000001 --password 'WLight@2026'

Creates or resets the production admin user for the Docker deployment.
Run this on the server after the stack is deployed.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$2"
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
    --name)
      ADMIN_NAME="$2"
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

if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
  echo "Admin password must be at least 8 characters." >&2
  exit 1
fi

cd "$APP_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB_NAME="${DB_NAME:-lightops}"
DB_USER="${DB_USER:-lightops}"

compose() {
  if docker ps >/dev/null 2>&1; then
    docker compose "$@"
  else
    sudo docker compose "$@"
  fi
}

compose ps api postgres >/dev/null

password_hash="$(
  compose exec -T api node -e "const bcrypt = require('bcryptjs'); bcrypt.hash(process.argv[1], 10).then(hash => console.log(hash));" "$ADMIN_PASSWORD" \
    | tr -d '\r'
)"

compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$DB_NAME" \
  -v project_name="$PROJECT_NAME" <<'SQL'
INSERT INTO projects (name, venue, address, status)
SELECT :'project_name', 'Main Theater', 'Sample address', 'active'
WHERE NOT EXISTS (SELECT 1 FROM projects);
SQL

project_id="$(
  compose exec -T postgres psql -U "$DB_USER" "$DB_NAME" -Atc 'SELECT id FROM projects ORDER BY "createdAt" ASC LIMIT 1;' \
    | tr -d '\r'
)"

if [[ -z "$project_id" ]]; then
  echo "Failed to resolve a project id." >&2
  exit 1
fi

compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$DB_NAME" \
  -v admin_name="$ADMIN_NAME" \
  -v phone="$ADMIN_PHONE" \
  -v password_hash="$password_hash" \
  -v project_id="$project_id" <<'SQL'
INSERT INTO users (name, phone, "passwordHash", role, "projectIds", "skillTags", "isActive")
VALUES (:'admin_name', :'phone', :'password_hash', 'admin', json_build_array(:'project_id')::text, '[]', true)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  "passwordHash" = EXCLUDED."passwordHash",
  role = 'admin',
  "projectIds" = EXCLUDED."projectIds",
  "isActive" = true,
  "updatedAt" = now();

UPDATE projects
SET "managerId" = (SELECT id FROM users WHERE phone = :'phone')
WHERE id = :'project_id';
SQL

echo
echo "Admin user is ready."
echo "Server address: /v1"
echo "Phone: ${ADMIN_PHONE}"
echo "Password: ${ADMIN_PASSWORD}"
