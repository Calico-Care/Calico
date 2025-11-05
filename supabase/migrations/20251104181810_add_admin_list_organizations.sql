-- Migration: Add admin.list_organizations SECURITY DEFINER function
-- Purpose: Allow ops-only Edge Functions (like stytch-sync) to list all organizations
--          without RLS blocking, similar to admin.get_organization.
--          This function bypasses RLS by using SECURITY DEFINER, allowing the app_edge
--          role to read all organizations when called from ops functions authenticated
--          with CALICO_OPS_TOKEN.

CREATE OR REPLACE FUNCTION admin.list_organizations()
RETURNS TABLE (
  id uuid,
  name text,
  stytch_organization_id text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, stytch_organization_id, created_at
  FROM public.organizations;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_edge') THEN
    GRANT EXECUTE ON FUNCTION admin.list_organizations() TO app_edge;
    GRANT USAGE ON SCHEMA admin TO app_edge;
  END IF;
END
$$;

