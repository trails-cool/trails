#!/bin/bash
set -euo pipefail

# Daily PostgreSQL backup
# Run via cron: 0 3 * * * /opt/trails-cool/scripts/backup-postgres.sh

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/trails_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting PostgreSQL backup..."

docker compose -f /opt/trails-cool/docker-compose.yml exec -T postgres \
  pg_dump -U trails trails | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup saved to ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

# Remove backups older than retention period
echo "[$(date)] Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "trails_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date)] Backup complete. Current backups:"
ls -lh "$BACKUP_DIR"/trails_*.sql.gz 2>/dev/null || echo "  No backups found"
