-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Enums
CREATE TYPE org_role AS ENUM ('org_admin','clinician','patient');
CREATE TYPE membership_status AS ENUM ('active','inactive');

-- Organizations (Calico creates; mapped to Stytch B2B org)
CREATE TABLE organizations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  stytch_organization_id  TEXT UNIQUE,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Users (IdP/auth only; Stytch user is the global identity)
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stytch_user_id TEXT UNIQUE NOT NULL,
  email          CITEXT UNIQUE NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Memberships (org-scoped identity + RBAC)
CREATE TABLE memberships (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  role             org_role NOT NULL,
  status           membership_status NOT NULL DEFAULT 'active',
  stytch_member_id TEXT UNIQUE, -- present for staff invited via B2B; NULL for patients (Consumer)
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
CREATE INDEX memberships_org_role_status_idx ON memberships(org_id, role, status);
CREATE INDEX memberships_user_idx            ON memberships(user_id);

-- Enforce single-org-per-account for staff roles
CREATE UNIQUE INDEX one_org_per_clinician ON memberships(user_id) WHERE role = 'clinician';
CREATE UNIQUE INDEX one_org_per_org_admin ON memberships(user_id) WHERE role = 'org_admin';

-- Clinicians (org-scoped profile; app ensures role correctness)
CREATE TABLE clinicians (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  user_id    UUID NOT NULL UNIQUE,
  npi        TEXT,
  specialty  TEXT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, user_id) REFERENCES memberships(org_id, user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX clinicians_org_id_pk_pair ON clinicians(org_id, id);
CREATE INDEX clinicians_org_idx ON clinicians(org_id);

-- Patients (PHI; org-scoped; multi-org allowed)
CREATE TABLE patients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  legal_name  TEXT NOT NULL,
  dob         DATE NOT NULL,
  phone_e164  TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  external_ref TEXT, -- MRN/clinic id per org
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id),
  UNIQUE (org_id, external_ref)
);
CREATE UNIQUE INDEX patients_org_id_pk_pair ON patients(org_id, id);
CREATE INDEX patients_org_status_idx ON patients(org_id, status);
CREATE INDEX patient_lookup_by_user ON patients(org_id, user_id);

-- Patient ↔ Clinician assignments (care team; org-guarded)
CREATE TABLE patient_clinicians (
  patient_id   UUID NOT NULL,
  clinician_id UUID NOT NULL,
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   UUID, -- users.id (auditing)
  PRIMARY KEY (patient_id, clinician_id),
  FOREIGN KEY (org_id, patient_id)   REFERENCES patients(org_id, id)    ON DELETE CASCADE,
  FOREIGN KEY (org_id, clinician_id) REFERENCES clinicians(org_id, id)  ON DELETE CASCADE
);
CREATE INDEX pc_by_org_patient   ON patient_clinicians(org_id, patient_id);
CREATE INDEX pc_by_org_clinician ON patient_clinicians(org_id, clinician_id);

-- Invitations (tracks B2B staff and Consumer patient invites)
CREATE TABLE invitations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email                CITEXT NOT NULL,
  role                 org_role NOT NULL,         -- 'org_admin'|'clinician'|'patient'
  invited_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  stytch_invitation_id TEXT,
  status               TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'accepted'|'revoked'|'expired'
  expires_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inv_pending_once_per_role
  ON invitations(org_id, email, role)
  WHERE status = 'pending';
