-- Migration: Add patient contact and medical aid number to cases
-- Timestamp: 2026-05-19 12:00:00

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'patient_email'
  ) THEN
    ALTER TABLE cases ADD COLUMN patient_email text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'patient_phone'
  ) THEN
    ALTER TABLE cases ADD COLUMN patient_phone text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'medical_aid_number'
  ) THEN
    ALTER TABLE cases ADD COLUMN medical_aid_number text DEFAULT '';
  END IF;
END $$;

-- Ensure RLS policy (no-op if already present)
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to cases" ON cases;
CREATE POLICY "Allow public read access to cases"
  ON cases FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow public insert to cases" ON cases;
CREATE POLICY "Allow public insert to cases"
  ON cases FOR INSERT
  TO anon
  WITH CHECK (true);
