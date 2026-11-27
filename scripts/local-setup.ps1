# One-time setup to run the whole shop on Windows (PowerShell 5+ or 7).
# Run from the project folder:   scripts\local-setup.cmd you@gmail.com
param([string]$OwnerEmail = "")
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Say($m)  { Write-Host ""; Write-Host ">> $m" -ForegroundColor Green }
function Fail($m) { Write-Host "X  $m" -ForegroundColor Red; exit 1 }
function Run($cmd, $arguments) {
  & $cmd @arguments
  if ($LASTEXITCODE -ne 0) { Fail "Command failed: $cmd $($arguments -join ' ')" }
}

Say "Checking tools"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js is missing. Install Node 22 LTS or newer from https://nodejs.org and open a new terminal." }
$v = (node -v).TrimStart("v").Split(".")
if ([int]$v[0] -lt 22 -or ([int]$v[0] -eq 22 -and [int]$v[1] -lt 12)) { Fail "Node $(node -v) is too old. Install Node 22.12 or newer." }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Say "Installing pnpm"
  Run "corepack" @("enable")
  Run "corepack" @("prepare", "pnpm@10.28.0", "--activate")
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail "Docker is missing. Install Docker Desktop from https://www.docker.com/products/docker-desktop , start it, then run this again." }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker is installed but not running. Start Docker Desktop, wait until it says 'running', then run this again." }

if (-not $OwnerEmail) { $OwnerEmail = Read-Host "Your Google email (becomes the admin Owner)" }
if ($OwnerEmail -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") { Fail "That does not look like an email address." }

Say "Creating .env"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
$lines = [System.Collections.Generic.List[string]](Get-Content .env)
function SetEnv($key, $value) {
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^$key=") { $lines[$i] = "$key=$value"; $found = $true }
  }
  if (-not $found) { $lines.Add("$key=$value") }
}
SetEnv "AUTH_TEST_MODE" "true"        # sign in without Google while testing
SetEnv "SEED_OWNER_EMAIL" $OwnerEmail
SetEnv "SEED_CATALOG" "demo"          # sample products with stock
# Write without a byte-order mark so Node can read the first line.
[System.IO.File]::WriteAllText((Join-Path (Get-Location) ".env"), (($lines -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding($false)))

Say "Starting the database (Postgres) and cache (Valkey)"
Run "docker" @("compose", "-f", "infra/compose/dev.yml", "up", "-d", "postgres", "valkey")
Write-Host -NoNewline "Waiting for Postgres"
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  docker compose -f infra/compose/dev.yml exec -T postgres pg_isready -U migrator -d dairy *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Write-Host -NoNewline "."; Start-Sleep -Seconds 2
}
Write-Host ""
if (-not $ready) { Fail "The database did not start. Open Docker Desktop and check the 'dairy-dev' containers." }

Say "Installing packages (first time takes a few minutes)"
Run "pnpm" @("install", "--frozen-lockfile")

Say "Creating tables and sample data"
Run "pnpm" @("db:migrate")
Run "pnpm" @("db:seed")

Write-Host ""
Write-Host "OK  Ready. Start everything with:" -ForegroundColor Green
Write-Host ""
Write-Host "    pnpm dev"
Write-Host ""
Write-Host "Then open:"
Write-Host "    Shop         http://localhost:3000"
Write-Host "    Admin        http://localhost:5173   (sign in with: $OwnerEmail)"
Write-Host "    API docs     http://localhost:4000/docs"
Write-Host ""
Write-Host "While testing, the shop shows a test sign-in box instead of Google, and payment uses a fake"
Write-Host "checkout page (no real money). Real keys: see docs\14-go-live.md"
Write-Host "To stop the database: docker compose -f infra/compose/dev.yml down"
