-- Migration: Add admin.update_organization SECURITY DEFINER function
-- Purpose: Allow ops-only Edge Functions (like stytch-sync) to update organization
--          data (name) without RLS blocking. This function bypasses RLS by using
--          SECURITY DEFINER, allowing the app_edge role to update organizations
--          when called from ops functions authenticated with CALICO_OPS_TOKEN.

CREATE OR REPLACE FUNCTION admin.update_organization(
  p_org_id uuid,
  p_name text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.organizations
  SET name = p_name
  WHERE id = p_org_id;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_edge') THEN
    GRANT EXECUTE ON FUNCTION admin.update_organization(uuid, text) TO app_edge;
    GRANT USAGE ON SCHEMA admin TO app_edge;
  END IF;
END
$$;

