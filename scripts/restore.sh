#!/usr/bin/env bash
# Restore a backup. By default it restores into a SCRATCH database (dairy_restore_check) so you can prove the
# backup works without touching live data. Add --live to replace the live database (the shop stops briefly).
#
#   scripts/restore.sh dairy-2026-12-01-0200.dump           # test restore
#   scripts/restore.sh dairy-2026-12-01-0200.dump --live    # real restore after a disaster
# The file must be in /opt/dairy/backups (download it from R2 first if the server was lost).
set -euo pipefail

FILE="${1:?usage: restore.sh <backup-file> [--live]}"
MODE="${2:-}"
ENV_FILE="${ENV_FILE:-/opt/dairy/.env}"
COMPOSE="docker compose -f $(dirname "$0")/../infra/compose/single.yml --env-file $ENV_FILE"
get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
USER="$(get POSTGRES_USER)"; DB="$(get POSTGRES_DB)"
[ -f "/opt/dairy/backups/$FILE" ] || { echo "No such file: /opt/dairy/backups/$FILE"; exit 1; }

if [ "$MODE" = "--live" ]; then
  read -r -p "This REPLACES the live database '$DB' with $FILE. Type YES to continue: " ok
  [ "$ok" = "YES" ] || { echo "Cancelled."; exit 1; }
  $COMPOSE stop web api worker
  $COMPOSE exec -T postgres psql -U "$USER" -d postgres -c "DROP DATABASE IF EXISTS $DB WITH (FORCE);" -c "CREATE DATABASE $DB OWNER $USER;"
  $COMPOSE exec -T postgres pg_restore -U "$USER" -d "$DB" --no-owner --role="$USER" "/backups/$FILE"
  $COMPOSE exec -T postgres psql -U "$USER" -d "$DB" -c "GRANT ALL ON SCHEMA public TO app;" -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;"
  $COMPOSE up -d
  echo "Restored into live database. Check the shop and the latest order."
else
  SCRATCH=dairy_restore_check
  $COMPOSE exec -T postgres psql -U "$USER" -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH WITH (FORCE);" -c "CREATE DATABASE $SCRATCH OWNER $USER;"
  $COMPOSE exec -T postgres pg_restore -U "$USER" -d "$SCRATCH" --no-owner --role="$USER" "/backups/$FILE"
  echo "Rows restored (compare with the live shop):"
  $COMPOSE exec -T postgres psql -U "$USER" -d "$SCRATCH" -Atc "select 'products', count(*) from products union all select 'orders', count(*) from orders union all select 'customers', count(*) from customers;"
  $COMPOSE exec -T postgres psql -U "$USER" -d postgres -c "DROP DATABASE $SCRATCH;"
  echo "Backup is good. The live database was not touched."
fi
