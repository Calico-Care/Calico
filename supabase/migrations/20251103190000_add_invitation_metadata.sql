-- Add metadata column to invitations for storing role-specific context (e.g., patient profile details)
ALTER TABLE public.invitations
  ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb

