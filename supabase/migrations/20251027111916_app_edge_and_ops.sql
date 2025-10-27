-- RLS: organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orgs_sel            ON public.organizations;
DROP POLICY IF EXISTS orgs_sel_ops_owner  ON public.organizations;
DROP POLICY IF EXISTS orgs_ins_ops_owner  ON public.organizations;

CREATE POLICY orgs_sel ON public.organizations
  FOR SELECT
  USING (id = current_setting('app.org_id', true)::uuid);

-- Ops-only path (function owner may differ; this policy targets calico_ops_owner when used)
CREATE POLICY orgs_sel_ops_owner ON public.organizations
  FOR SELECT TO calico_ops_owner
  USING (true);

CREATE POLICY orgs_ins_ops_owner ON public.organizations
  FOR INSERT TO calico_ops_owner
  WITH CHECK (true);

-- Admin schema and definer function
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

REVOKE ALL ON FUNCTION admin.create_organization(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin.create_organization(text, text) TO app_edge;
GRANT USAGE ON SCHEMA admin TO app_edge;

