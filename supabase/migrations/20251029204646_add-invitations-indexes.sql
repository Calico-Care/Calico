-- Invitations performance indexes

-- Lookups by org + email (e.g., accepting an invite by email)
CREATE INDEX IF NOT EXISTS inv_org_email_idx
  ON invitations(org_id, email);

-- Listing/filtering by status per org (e.g., pending/accepted views)
CREATE INDEX IF NOT EXISTS inv_org_status_idx
  ON invitations(org_id, status);

-- Provider/token-based acceptance callbacks
CREATE INDEX IF NOT EXISTS inv_stytch_id_idx
  ON invitations(stytch_invitation_id)
  WHERE stytch_invitation_id IS NOT NULL;

-- Recency sorting per org
CREATE INDEX IF NOT EXISTS inv_org_created_at_idx
  ON invitations(org_id, created_at DESC);


