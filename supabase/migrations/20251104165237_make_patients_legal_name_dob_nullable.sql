-- Make legal_name and dob nullable to support initial patient creation
-- These will be filled in by clinicians during invitation or by patients later

ALTER TABLE patients 
  ALTER COLUMN legal_name DROP NOT NULL,
  ALTER COLUMN dob DROP NOT NULL;

-- Add comment explaining the workflow
COMMENT ON COLUMN patients.legal_name IS 'Patient legal name. Initially NULL, can be provided by clinician during invitation or filled by patient during onboarding.';
COMMENT ON COLUMN patients.dob IS 'Patient date of birth. Initially NULL, can be provided by clinician during invitation or filled by patient during onboarding.';

