-- MIGRATION: RLS for multi-tenant isolation
-- Contract: application sets session GUCs per request:
--   SET LOCAL app.user_id = '<users.id UUID>';
--   SET LOCAL app.org_id  = '<organizations.id UUID>';

BEGIN;

-- Organizations (restrict visibility to caller's org)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orgs_sel ON organizations;
CREATE POLICY orgs_sel ON organizations
  FOR SELECT USING (id = current_setting('app.org_id', true)::uuid);

-- Users (global identity; no RLS to avoid cross-tenant joins in auth flows)
-- If you need RLS later, add policies keyed by app.user_id.

-- Memberships (org-scoped identity + RBAC)
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memberships_sel ON memberships;
DROP POLICY IF EXISTS memberships_ins ON memberships;
DROP POLICY IF EXISTS memberships_upd ON memberships;
DROP POLICY IF EXISTS memberships_del ON memberships;

CREATE POLICY memberships_sel ON memberships
  FOR SELECT USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY memberships_ins ON memberships
  FOR INSERT WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY memberships_upd ON memberships
  FOR UPDATE USING (org_id = current_setting('app.org_id', true)::uuid)
             WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY memberships_del ON memberships
  FOR DELETE USING (org_id = current_setting('app.org_id', true)::uuid);

-- Clinicians (org-scoped profile)
ALTER TABLE clinicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinicians FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinicians_sel ON clinicians;
DROP POLICY IF EXISTS clinicians_ins ON clinicians;
DROP POLICY IF EXISTS clinicians_upd ON clinicians;
DROP POLICY IF EXISTS clinicians_del ON clinicians;

CREATE POLICY clinicians_sel ON clinicians
  FOR SELECT USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY clinicians_ins ON clinicians
  FOR INSERT WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY clinicians_upd ON clinicians
  FOR UPDATE USING (org_id = current_setting('app.org_id', true)::uuid)
             WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY clinicians_del ON clinicians
  FOR DELETE USING (org_id = current_setting('app.org_id', true)::uuid);

-- Patients (PHI; org-scoped; multi-org allowed)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_sel ON patients;
DROP POLICY IF EXISTS patients_ins ON patients;
DROP POLICY IF EXISTS patients_upd ON patients;
DROP POLICY IF EXISTS patients_del ON patients;

CREATE POLICY patients_sel ON patients
  FOR SELECT USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY patients_ins ON patients
  FOR INSERT WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY patients_upd ON patients
  FOR UPDATE USING (org_id = current_setting('app.org_id', true)::uuid)
             WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY patients_del ON patients
  FOR DELETE USING (org_id = current_setting('app.org_id', true)::uuid);

-- Patient ↔ Clinician assignments (care team; org-guarded)
ALTER TABLE patient_clinicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_clinicians FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pc_sel ON patient_clinicians;
DROP POLICY IF EXISTS pc_ins ON patient_clinicians;
DROP POLICY IF EXISTS pc_upd ON patient_clinicians;
DROP POLICY IF EXISTS pc_del ON patient_clinicians;

CREATE POLICY pc_sel ON patient_clinicians
  FOR SELECT USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY pc_ins ON patient_clinicians
  FOR INSERT WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY pc_upd ON patient_clinicians
  FOR UPDATE USING (org_id = current_setting('app.org_id', true)::uuid)
             WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY pc_del ON patient_clinicians
  FOR DELETE USING (org_id = current_setting('app.org_id', true)::uuid);

-- Invitations (org-scoped tracking)
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invites_sel ON invitations;
DROP POLICY IF EXISTS invites_ins ON invitations;
DROP POLICY IF EXISTS invites_upd ON invitations;
DROP POLICY IF EXISTS invites_del ON invitations;

CREATE POLICY invites_sel ON invitations
  FOR SELECT USING (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY invites_ins ON invitations
  FOR INSERT WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY invites_upd ON invitations
  FOR UPDATE USING (org_id = current_setting('app.org_id', true)::uuid)
             WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY invites_del ON invitations
  FOR DELETE USING (org_id = current_setting('app.org_id', true)::uuid);

COMMIT;
