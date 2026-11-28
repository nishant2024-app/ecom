#!/usr/bin/env bash
# One-time setup to run the whole shop on your own computer (macOS, Linux, or Windows with WSL / Git Bash).
# Usage:  ./scripts/local-setup.sh you@gmail.com        (the email becomes the Owner of the admin panel)
set -euo pipefail
cd "$(dirname "$0")/.."

OWNER_EMAIL="${1:-}"
say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

say "Checking tools"
command -v node >/dev/null || fail "Node.js is missing. Install Node 22 or newer from https://nodejs.org"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=12)?0:1)' || fail "Node $(node -v) is too old. Install Node 22.12 or newer."
if ! command -v pnpm >/dev/null; then
  say "Installing pnpm"
  if command -v corepack >/dev/null && corepack enable 2>/dev/null && corepack prepare pnpm@10.28.0 --activate 2>/dev/null; then
    :
  else
    # Node 25+ no longer ships corepack: install pnpm with npm into your home folder (no sudo needed).
    command -v npm >/dev/null || fail "npm is missing. Reinstall Node from https://nodejs.org"
    npm install -g --prefix "$HOME/.local" pnpm@10.28.0
    export PATH="$HOME/.local/bin:$PATH"
    grep -qs '.local/bin' "$HOME/.bashrc" || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
  fi
  command -v pnpm >/dev/null || fail "Could not install pnpm. Run: npm install -g pnpm"
fi
command -v docker >/dev/null || fail "Docker is missing. Install Docker Desktop from https://www.docker.com/products/docker-desktop and start it."
docker info >/dev/null 2>&1 || fail "Docker is installed but not running. Start Docker Desktop, then run this again."

if [ -z "$OWNER_EMAIL" ]; then
  read -r -p "Your Google email (becomes the admin Owner): " OWNER_EMAIL
fi
[[ "$OWNER_EMAIL" == *@*.* ]] || fail "That does not look like an email address."

say "Creating .env"
if [ ! -f .env ]; then cp .env.example .env; fi
set_env() { # set_env KEY VALUE  (replace the line, or append it)
  if grep -q "^$1=" .env; then
    sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak
  else
    echo "$1=$2" >> .env
  fi
}
set_env AUTH_TEST_MODE true          # lets you sign in without Google while testing
set_env SEED_OWNER_EMAIL "$OWNER_EMAIL"
set_env SEED_CATALOG demo            # sample products with stock so the shop is not empty

say "Starting the database (Postgres) and cache (Valkey)"
docker compose -f infra/compose/dev.yml up -d postgres valkey
printf "Waiting for Postgres"
for _ in $(seq 1 40); do
  docker compose -f infra/compose/dev.yml exec -T postgres pg_isready -U migrator -d dairy >/dev/null 2>&1 && break
  printf "."; sleep 2
done
echo

say "Installing packages (first time takes a few minutes)"
pnpm install --frozen-lockfile

say "Creating tables and sample data"
pnpm db:migrate
pnpm db:seed

printf '\n\033[1;32m✓ Ready.\033[0m Start everything with:\n\n    pnpm dev\n\n'
if [ -d "$HOME/.local/bin" ] && ! command -v pnpm >/dev/null 2>&1; then :; fi
case ":$PATH:" in *":$HOME/.local/bin:"*) if [ -x "$HOME/.local/bin/pnpm" ]; then printf 'If "pnpm: command not found" appears, run this once:  export PATH="$HOME/.local/bin:$PATH"\n\n'; fi;; esac
cat <<MSG
Then open:
    Shop         http://localhost:3000
    Admin        http://localhost:5173      (sign in with: $OWNER_EMAIL)
    API docs     http://localhost:4000/docs

While testing, the shop shows a "test sign-in" box instead of Google, and payment uses a fake
test checkout page (no real money). Add real keys later: see docs/14-go-live.md.
Using Google Cloud Shell? Open the shop and admin with "Web Preview" on ports 3000 and 5173.
To stop the database: docker compose -f infra/compose/dev.yml down
MSG
