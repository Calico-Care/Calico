-- LOCAL DEVELOPMENT ONLY
-- This seed runs after migrations on local via `supabase db reset`.
-- It is NOT applied to the remote database by `supabase db push`.
-- May contain development-only passwords/values; do not reuse in production.
-- How to use locally:
--   supabase start
--   supabase db reset

-- Base privileges for app_edge (needed for normal DML; RLS still enforces rows)
GRANT USAGE ON SCHEMA public TO app_edge;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_edge;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_edge;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_edge;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_edge;

-- Admin definer function + schema grants if present
DO $$
BEGIN
  IF to_regprocedure('admin.create_organization(text, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION admin.create_organization(text, text) TO app_edge;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'admin') THEN
    GRANT USAGE ON SCHEMA admin TO app_edge;
  END IF;
END$$;
