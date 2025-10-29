-- RLS: organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

-- Replace role-specific policies with role-agnostic predicates
DROP POLICY IF EXISTS orgs_sel             ON public.organizations;
DROP POLICY IF EXISTS orgs_sel_ops_owner   ON public.organizations;
DROP POLICY IF EXISTS orgs_ins_ops_owner   ON public.organizations;
DROP POLICY IF EXISTS orgs_sel_ops         ON public.organizations;
DROP POLICY IF EXISTS orgs_ins_ops         ON public.organizations;

-- Tenant read: only current org
CREATE POLICY orgs_sel ON public.organizations
  FOR SELECT
  USING (id = current_setting('app.org_id', true)::uuid);

-- Ops: allowed when caller is member of calico_ops_owner
CREATE POLICY orgs_sel_ops ON public.organizations
  FOR SELECT
  USING (pg_has_role(current_user, 'calico_ops_owner', 'member'));

CREATE POLICY orgs_ins_ops ON public.organizations
  FOR INSERT
  WITH CHECK (pg_has_role(current_user, 'calico_ops_owner', 'member'));

-- Admin schema + SECURITY DEFINER function
CREATE SCHEMA IF NOT EXISTS admin;

CREATE OR REPLACE FUNCTION admin.create_organization(p_name text, p_stytch_id text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.organizations (id, name, stytch_organization_id, created_at)
  VALUES (gen_random_uuid(), p_name, p_stytch_id, now())
  ON CONFLICT (stytch_organization_id)
  DO UPDATE SET name = EXCLUDED.name
  RETURNING id;
$$;

-- Lock down function
REVOKE ALL ON FUNCTION admin.create_organization(text, text) FROM PUBLIC;

-- Conditional grants so migration succeeds pre-roles and configures remote where roles already exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_edge') THEN
    GRANT EXECUTE ON FUNCTION admin.create_organization(text, text) TO app_edge;
    GRANT USAGE ON SCHEMA admin TO app_edge;

    -- Base privileges for app_edge (privilege check is before RLS)
    GRANT USAGE ON SCHEMA public TO app_edge;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_edge;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_edge;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_edge;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO app_edge;
  END IF;
END$$;
