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

BACKUP_ROOT="${BACKUP_ROOT:-${APP_DIR}/deploy/backups}"
RESTORE_DIR=""

usage() {
  cat <<'USAGE'
Usage:
  scripts/server-backup.sh
  scripts/server-backup.sh --restore /root/W-Light/deploy/backups/20260603-120000

Backs up or restores the production Docker deployment:
  - PostgreSQL dump
  - MinIO data volume
  - .env snapshot

Run from the server that hosts W-Light.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --backup-root)
      BACKUP_ROOT="$2"
      shift 2
      ;;
    --restore)
      RESTORE_DIR="$2"
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

cd "$APP_DIR"

compose() {
  if docker ps >/dev/null 2>&1; then
    docker compose "$@"
  else
    sudo docker compose "$@"
  fi
}

docker_run() {
  if docker ps >/dev/null 2>&1; then
    docker run "$@"
  else
    sudo docker run "$@"
  fi
}

backup() {
  local stamp
  local target
  stamp="$(date +%Y%m%d-%H%M%S)"
  target="${BACKUP_ROOT}/${stamp}"
  mkdir -p "$target"

  compose ps >/dev/null
  compose exec -T postgres sh -c 'pg_dump --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"' > "${target}/postgres.sql"
  docker_run --rm --volumes-from lightops-minio -v "${target}:/backup" alpine:3.20 \
    tar -czf /backup/minio-data.tar.gz -C /data .

  if [[ -f .env ]]; then
    cp .env "${target}/env.snapshot"
  fi

  cat > "${target}/README.txt" <<EOF
W-Light server backup created at ${stamp}

Files:
- postgres.sql: PostgreSQL database dump
- minio-data.tar.gz: MinIO object storage data
- env.snapshot: environment snapshot if .env existed

Restore:
cd ${APP_DIR}
bash scripts/server-backup.sh --restore ${target}
EOF

  echo "Backup completed: ${target}"
}

restore() {
  local source="$1"
  if [[ ! -f "${source}/postgres.sql" || ! -f "${source}/minio-data.tar.gz" ]]; then
    echo "Invalid backup directory: ${source}" >&2
    exit 1
  fi

  echo "Restoring backup from ${source}"
  echo "This will overwrite current PostgreSQL and MinIO data."
  compose ps >/dev/null

  compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < "${source}/postgres.sql"
  compose stop minio
  docker_run --rm --volumes-from lightops-minio -v "${source}:/backup" alpine:3.20 \
    sh -c 'rm -rf /data/* && tar -xzf /backup/minio-data.tar.gz -C /data'
  compose up -d minio

  echo "Restore completed. Restarting API and Web..."
  compose up -d api web
}

if [[ -n "$RESTORE_DIR" ]]; then
  restore "$RESTORE_DIR"
else
  backup
fi
