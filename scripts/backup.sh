#!/usr/bin/env bash
# Nightly database backup: dumps Postgres, keeps 7 days on the server, uploads to a Cloudflare R2 bucket.
# Run by cron on the server (see docs/17-deploy-single-server.md):  0 2 * * *  /opt/dairy/app/scripts/backup.sh
# Set a 30-day "delete after" lifecycle rule on the R2 backup bucket in the Cloudflare dashboard.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/dairy/.env}"
COMPOSE="docker compose -f $(dirname "$0")/../infra/compose/single.yml --env-file $ENV_FILE"
DIR="${BACKUP_DIR:-/opt/dairy/backups}"
get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }

STAMP="$(date -u +%Y-%m-%d-%H%M)"
FILE="dairy-$STAMP.dump"
mkdir -p "$DIR"

echo "[$(date -u +%FT%TZ)] dumping database"
$COMPOSE exec -T postgres pg_dump -U "$(get POSTGRES_USER)" -d "$(get POSTGRES_DB)" -Fc > "$DIR/$FILE.partial"
mv "$DIR/$FILE.partial" "$DIR/$FILE"
SIZE=$(wc -c < "$DIR/$FILE")
[ "$SIZE" -gt 10000 ] || { echo "backup looks empty ($SIZE bytes)"; exit 1; }

BUCKET="$(get BACKUP_BUCKET)"
if [ -n "$BUCKET" ] && [ -n "$(get R2_ACCOUNT_ID)" ]; then
  echo "[$(date -u +%FT%TZ)] uploading to R2 bucket $BUCKET"
  docker run --rm -v "$DIR:/backups:ro" \
    -e AWS_ACCESS_KEY_ID="$(get R2_ACCESS_KEY_ID)" -e AWS_SECRET_ACCESS_KEY="$(get R2_SECRET_ACCESS_KEY)" -e AWS_DEFAULT_REGION=auto \
    amazon/aws-cli s3 cp "/backups/$FILE" "s3://$BUCKET/$FILE" --endpoint-url "https://$(get R2_ACCOUNT_ID).r2.cloudflarestorage.com"
else
  echo "BACKUP_BUCKET or R2 keys not set: backup kept on this server only"
fi

# Photos kept on this server's disk (no R2) are backed up too. Restore with:
#   docker run --rm -v dairy_media:/media -v /opt/dairy/backups:/in alpine tar xzf /in/media-<stamp>.tgz -C /media
if [ -z "$(get R2_ACCOUNT_ID)" ]; then
  echo "[$(date -u +%FT%TZ)] archiving the local photo folder"
  docker run --rm -v dairy_media:/media:ro -v "$DIR:/out" alpine tar czf "/out/media-$STAMP.tgz" -C /media .
fi

# Keep the last 7 days on the server.
find "$DIR" \( -name 'dairy-*.dump' -o -name 'media-*.tgz' \) -mtime +7 -delete
echo "[$(date -u +%FT%TZ)] done: $FILE ($SIZE bytes)"
