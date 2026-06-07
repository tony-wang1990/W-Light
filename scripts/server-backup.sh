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
VERIFY_DIR=""
LIST_BACKUPS=false
PRUNE_BACKUPS=false
ASSUME_YES=false
KEEP_BACKUPS="${KEEP_BACKUPS:-14}"
INSTALL_CRON=false
REMOVE_CRON=false
CRON_SCHEDULE="${CRON_SCHEDULE:-15 3 * * *}"
CRON_LOG="${CRON_LOG:-${APP_DIR}/deploy/backups/backup.log}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/server-backup.sh [options]
  scripts/server-backup.sh --list
  scripts/server-backup.sh --verify /root/W-Light/deploy/backups/20260603-120000
  scripts/server-backup.sh --restore /root/W-Light/deploy/backups/20260603-120000 --yes
  scripts/server-backup.sh --prune --keep 14 --yes
  scripts/server-backup.sh --install-cron --cron "15 3 * * *" --keep 14
  scripts/server-backup.sh --remove-cron

Backs up or restores the production Docker deployment:
  - PostgreSQL dump
  - MinIO data volume
  - .env snapshot

Options:
  --app-dir DIR       App directory, default /root/W-Light for root
  --backup-root DIR   Backup root, default APP_DIR/deploy/backups
  --list              List available backups
  --verify DIR        Verify required files, checksum manifest and MinIO archive
  --restore DIR       Restore a backup directory
  --prune             Remove older backup directories, keeping the newest N
  --keep N            Backup directories to keep when pruning, default 14
  --install-cron      Install or update a daily cron backup job
  --remove-cron       Remove the W-Light cron backup job
  --cron SCHEDULE     Cron schedule for --install-cron, default "15 3 * * *"
  --cron-log FILE     Cron log file, default APP_DIR/deploy/backups/backup.log
  --yes               Confirm destructive restore/prune operations

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
    --verify)
      VERIFY_DIR="$2"
      shift 2
      ;;
    --list)
      LIST_BACKUPS=true
      shift
      ;;
    --prune)
      PRUNE_BACKUPS=true
      shift
      ;;
    --keep)
      KEEP_BACKUPS="$2"
      shift 2
      ;;
    --install-cron)
      INSTALL_CRON=true
      shift
      ;;
    --remove-cron)
      REMOVE_CRON=true
      shift
      ;;
    --cron)
      CRON_SCHEDULE="$2"
      shift 2
      ;;
    --cron-log)
      CRON_LOG="$2"
      shift 2
      ;;
    -y|--yes)
      ASSUME_YES=true
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

if ! [[ "$KEEP_BACKUPS" =~ ^[0-9]+$ ]] || (( KEEP_BACKUPS < 1 )); then
  echo "Invalid --keep value: $KEEP_BACKUPS" >&2
  exit 1
fi

if [[ "$INSTALL_CRON" == "true" && "$REMOVE_CRON" == "true" ]]; then
  echo "Choose only one of --install-cron or --remove-cron." >&2
  exit 1
fi

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

backup_dirs() {
  if [[ ! -d "$BACKUP_ROOT" ]]; then
    return 0
  fi
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | sort
}

backup_size() {
  du -sh "$1" 2>/dev/null | awk '{ print $1 }'
}

list_backups() {
  local found=false
  echo "Backup root: ${BACKUP_ROOT}"
  while IFS= read -r backup_dir; do
    found=true
    local name
    local size
    local status="OK"
    name="$(basename "$backup_dir")"
    size="$(backup_size "$backup_dir")"
    if [[ ! -s "${backup_dir}/postgres.sql" || ! -s "${backup_dir}/minio-data.tar.gz" ]]; then
      status="INCOMPLETE"
    fi
    printf '%-20s %-8s %s\n' "$name" "${size:-unknown}" "$status"
  done < <(backup_dirs)

  if [[ "$found" == "false" ]]; then
    echo "No backups found."
  fi
}

write_manifest() {
  local target="$1"
  local commit="unknown"
  commit="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"

  cat > "${target}/MANIFEST.txt" <<EOF
created_at=$(date -Iseconds)
app_dir=${APP_DIR}
git_commit=${commit}
backup_root=${BACKUP_ROOT}
EOF

  (
    cd "$target"
    : > SHA256SUMS
    for file in postgres.sql minio-data.tar.gz env.snapshot MANIFEST.txt; do
      if [[ -f "$file" ]]; then
        sha256sum "$file" >> SHA256SUMS
      fi
    done
  )
}

verify_backup() {
  local source="$1"
  if [[ ! -d "$source" ]]; then
    echo "Backup directory does not exist: ${source}" >&2
    exit 1
  fi
  if [[ ! -s "${source}/postgres.sql" ]]; then
    echo "Missing or empty PostgreSQL dump: ${source}/postgres.sql" >&2
    exit 1
  fi
  if [[ ! -s "${source}/minio-data.tar.gz" ]]; then
    echo "Missing or empty MinIO archive: ${source}/minio-data.tar.gz" >&2
    exit 1
  fi
  tar -tzf "${source}/minio-data.tar.gz" >/dev/null

  if [[ -f "${source}/SHA256SUMS" ]]; then
    (cd "$source" && sha256sum -c SHA256SUMS >/dev/null)
  else
    echo "Warning: SHA256SUMS not found, skipped checksum verification." >&2
  fi

  echo "Backup verified: ${source}"
}

confirm_destructive() {
  local token="$1"
  local action="$2"

  if [[ "$ASSUME_YES" == "true" || "${W_LIGHT_ASSUME_YES:-}" == "1" ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    echo "${action} requires confirmation. Re-run with --yes in non-interactive shells." >&2
    exit 1
  fi

  echo "${action}"
  echo "Type ${token} to continue:"
  local answer
  read -r answer
  if [[ "$answer" != "$token" ]]; then
    echo "Cancelled."
    exit 1
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

  write_manifest "$target"
  verify_backup "$target"

  cat > "${target}/README.txt" <<EOF
W-Light server backup created at ${stamp}

Files:
- postgres.sql: PostgreSQL database dump
- minio-data.tar.gz: MinIO object storage data
- env.snapshot: environment snapshot if .env existed

Restore:
cd ${APP_DIR}
bash scripts/server-backup.sh --restore ${target} --yes
EOF

  echo "Backup completed: ${target}"
}

restore() {
  local source="$1"
  verify_backup "$source"

  echo "Restoring backup from ${source}"
  echo "This will overwrite current PostgreSQL and MinIO data."
  confirm_destructive "RESTORE" "Restore will overwrite current PostgreSQL and MinIO data."
  compose ps >/dev/null

  compose stop api web >/dev/null || true
  compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"' < "${source}/postgres.sql"
  compose stop minio
  docker_run --rm --volumes-from lightops-minio -v "${source}:/backup" alpine:3.20 \
    sh -c 'find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -xzf /backup/minio-data.tar.gz -C /data'
  compose up -d minio

  echo "Restore completed. Restarting API and Web..."
  compose up -d api web
  compose ps
}

prune_backups() {
  mapfile -t backups < <(backup_dirs)
  local total="${#backups[@]}"
  local remove_count=$(( total - KEEP_BACKUPS ))

  if (( remove_count <= 0 )); then
    echo "No backups to prune. Found ${total}, keep ${KEEP_BACKUPS}."
    return
  fi

  echo "Will remove ${remove_count} old backup(s), keeping newest ${KEEP_BACKUPS}:"
  for (( i = 0; i < remove_count; i++ )); do
    echo "- ${backups[$i]}"
  done
  confirm_destructive "PRUNE" "Backup pruning will permanently delete old backup directories."

  for (( i = 0; i < remove_count; i++ )); do
    rm -rf -- "${backups[$i]}"
  done
  echo "Prune completed."
}

shell_quote() {
  printf '%q' "$1"
}

without_existing_cron() {
  awk '
    /^# W-Light backup job$/ {
      skip = 2
    }
    skip > 0 {
      skip--
      next
    }
    {
      print
    }
  '
}

install_cron() {
  if ! command -v crontab >/dev/null 2>&1; then
    echo "crontab command not found. Install cron first." >&2
    exit 1
  fi

  mkdir -p "$(dirname "$CRON_LOG")"

  local app_dir_q
  local backup_root_q
  local cron_log_q
  local command_line
  app_dir_q="$(shell_quote "$APP_DIR")"
  backup_root_q="$(shell_quote "$BACKUP_ROOT")"
  cron_log_q="$(shell_quote "$CRON_LOG")"
  command_line="cd ${app_dir_q} && APP_DIR=${app_dir_q} BACKUP_ROOT=${backup_root_q} bash scripts/server-backup.sh >> ${cron_log_q} 2>&1 && APP_DIR=${app_dir_q} BACKUP_ROOT=${backup_root_q} bash scripts/server-backup.sh --prune --keep ${KEEP_BACKUPS} --yes >> ${cron_log_q} 2>&1"

  {
    crontab -l 2>/dev/null | without_existing_cron || true
    echo "# W-Light backup job"
    echo "${CRON_SCHEDULE} ${command_line}"
  } | crontab -

  echo "Cron backup job installed:"
  echo "${CRON_SCHEDULE} ${command_line}"
}

remove_cron() {
  if ! command -v crontab >/dev/null 2>&1; then
    echo "crontab command not found. Nothing removed." >&2
    exit 1
  fi

  { crontab -l 2>/dev/null || true; } | without_existing_cron | crontab -
  echo "W-Light cron backup job removed."
}

if [[ "$LIST_BACKUPS" == "true" ]]; then
  list_backups
elif [[ -n "$VERIFY_DIR" ]]; then
  verify_backup "$VERIFY_DIR"
elif [[ "$PRUNE_BACKUPS" == "true" ]]; then
  prune_backups
elif [[ "$INSTALL_CRON" == "true" ]]; then
  install_cron
elif [[ "$REMOVE_CRON" == "true" ]]; then
  remove_cron
elif [[ -n "$RESTORE_DIR" ]]; then
  restore "$RESTORE_DIR"
else
  backup
fi
