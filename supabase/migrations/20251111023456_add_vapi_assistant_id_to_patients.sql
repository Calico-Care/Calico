-- Migration: Add vapi_assistant_id column to patients table
-- Purpose: Link each patient to their dedicated VAPI AI assistant.
-- One assistant per (org_id, user_id) pair - each org gets its own assistant for the same patient.

ALTER TABLE public.patients
ADD COLUMN vapi_assistant_id TEXT UNIQUE;

-- Add a partial index for faster lookups of patients with VAPI assistants
CREATE INDEX IF NOT EXISTS patients_vapi_assistant_id_idx
ON public.patients (vapi_assistant_id)
WHERE vapi_assistant_id IS NOT NULL;

