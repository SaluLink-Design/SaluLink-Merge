-- Practitioner role on profiles for CIB path auto-resolution

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS practitioner_role text NOT NULL DEFAULT 'gp'
  CHECK (practitioner_role IN (
    'gp',
    'neurologist',
    'specialist',
    'clinical_technologist',
    'pathologist'
  ));
