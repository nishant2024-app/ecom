#!/usr/bin/env bash
# Update the live server to the latest code. Run on the server:  /opt/dairy/app/scripts/deploy.sh
# Safe order: back up, pull, build, migrate, restart, wait until healthy.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-/opt/dairy/.env}"
COMPOSE="docker compose -f infra/compose/single.yml --env-file $ENV_FILE"

say() { printf '\n\033[1;32m> %s\033[0m\n' "$*"; }

if $COMPOSE ps --status running --services 2>/dev/null | grep -q postgres; then
  say "Backing up the database first"
  ./scripts/backup.sh
fi

say "Pulling the latest code"
git fetch --quiet origin
BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
git checkout --quiet "$BRANCH"
git pull --ff-only --quiet origin "$BRANCH"
export GIT_SHA="$(git rev-parse --short HEAD)"
echo "Deploying $BRANCH @ $GIT_SHA"

say "Building images (the first build takes several minutes)"
$COMPOSE build

say "Applying database changes and starting"
$COMPOSE up -d --remove-orphans

say "Waiting for the API to be healthy"
for _ in $(seq 1 40); do
  state="$($COMPOSE ps api --format '{{.Health}}' 2>/dev/null || true)"
  [ "$state" = "healthy" ] && break
  printf '.'; sleep 3
done
echo
if [ "${state:-}" != "healthy" ]; then
  echo "The API did not become healthy. Last log lines:"; $COMPOSE logs --tail 40 api
  echo "Roll back with:  git checkout <previous commit> && ./scripts/deploy.sh"
  exit 1
fi

say "Running"
$COMPOSE ps
echo "Deployed $GIT_SHA."
