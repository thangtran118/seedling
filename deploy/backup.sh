#!/usr/bin/env bash
# Runs ON the server: dumps the database to /opt/seedling/backups and keeps the last 14 days.
# If S3_BUCKET is set (in .env or the environment) and the AWS CLI is installed, the dump is also copied to S3.
#   crontab -e  →  30 2 * * * /opt/seedling/deploy/backup.sh >> /opt/seedling/backups/backup.log 2>&1
set -euo pipefail

APP_DIR="${SEEDLING_DIR:-/opt/seedling}"
cd "$APP_DIR"
S3_BUCKET="${S3_BUCKET:-$(grep -E '^S3_BUCKET=' .env | cut -d= -f2- || true)}"

umask 077 # the dump holds private listener data
file="backups/seedling-$(date +%F-%H%M).dump"
docker compose exec -T db pg_dump -U seedling -Fc seedling > "$file"
find backups -name 'seedling-*.dump' -mtime +14 -delete
echo "$(date '+%F %T') đã lưu $file ($(du -h "$file" | cut -f1))"

if [ -n "$S3_BUCKET" ]; then
  aws s3 cp "$file" "s3://$S3_BUCKET/$(basename "$file")" --sse AES256 --only-show-errors
  echo "$(date '+%F %T') đã chép lên s3://$S3_BUCKET"
fi
