-- Least privilege for the application role (docs/05-data-model.md#database-users).
-- The app role is created by infrastructure (Ansible / local setup); skip quietly if missing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app') THEN
    GRANT USAGE ON SCHEMA public TO app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
    -- Append-only history tables: no UPDATE or DELETE for the app.
    REVOKE UPDATE, DELETE ON stock_movements, order_events, audit_log FROM app;
    REVOKE DELETE ON webhook_events, payments, refunds, orders, order_items FROM app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;
  END IF;
END $$;
