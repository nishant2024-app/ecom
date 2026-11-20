-- Local roles and the test database (production roles are created by Ansible with real passwords).
CREATE ROLE app LOGIN PASSWORD 'app';
CREATE DATABASE dairy_test OWNER migrator;
\c dairy
CREATE EXTENSION IF NOT EXISTS pg_trgm;
GRANT ALL ON SCHEMA public TO app;
\c dairy_test
CREATE EXTENSION IF NOT EXISTS pg_trgm;
GRANT ALL ON SCHEMA public TO app;
