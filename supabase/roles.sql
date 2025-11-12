-- Ensure required roles exist before migrations run.
-- Supabase CLI executes this file ahead of migrations, so keep it idempotent.

-- Create or update app_edge role using injected password.
DO $$
DECLARE
  app_edge_password text := nullif(current_setting('app.settings.app_edge_password', true), '');
BEGIN
  IF app_edge_password IS NULL THEN
    app_edge_password := 'dev_password';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_edge') THEN
    EXECUTE format(
      'CREATE ROLE app_edge LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
      app_edge_password
    );
  ELSE
    EXECUTE format('ALTER ROLE app_edge WITH LOGIN PASSWORD %L', app_edge_password);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'calico_ops_owner') THEN
    CREATE ROLE calico_ops_owner NOLOGIN NOINHERIT;
  END IF;
END
$$;
