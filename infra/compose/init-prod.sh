#!/bin/sh
# Runs once, when the Postgres data folder is first created. Passwords come from the environment file.
# POSTGRES_USER is the migrator role (owns the tables); the API connects as the less-privileged "app" role.
set -e
: "${APP_DB_PASSWORD:?set APP_DB_PASSWORD in the env file}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE app LOGIN PASSWORD '${APP_DB_PASSWORD}';
CREATE EXTENSION IF NOT EXISTS pg_trgm;
GRANT ALL ON SCHEMA public TO app;
SQL
