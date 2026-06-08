#!/usr/bin/env sh
# W-Light 自动数据库备份脚本
# 每天凌晨 2 点执行，备份 PostgreSQL 到 MinIO，保留 30 天

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="lightops-pg-${DATE}.sql.gz"
BUCKET="${MINIO_BUCKET:-lightops-files}"
BACKUP_DIR="backups"

echo "[$(date)] 开始备份数据库..."

# pg_dump 并 gzip 压缩，直接通过管道上传到 MinIO
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-password \
  | gzip \
  | mc pipe "myminio/${BUCKET}/${BACKUP_DIR}/${BACKUP_FILE}"

echo "[$(date)] 备份完成: ${BACKUP_DIR}/${BACKUP_FILE}"

# 清理 30 天前的旧备份
echo "[$(date)] 清理 30 天前的旧备份..."
mc find "myminio/${BUCKET}/${BACKUP_DIR}/" \
  --name "lightops-pg-*.sql.gz" \
  --older-than 30d \
  | xargs -r mc rm --force

echo "[$(date)] 备份任务完成！"
