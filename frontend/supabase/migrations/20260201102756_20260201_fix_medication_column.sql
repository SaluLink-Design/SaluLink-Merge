/*
  # Fix Medication Column Mapping

  ## Issue
  The case_medications table originally had a medication_name column with NOT NULL constraint.
  A new medicine_name_and_strength column was added, but the old column wasn't removed.
  This causes insert errors when trying to save medications.

  ## Solution
  Drop the old medication_name column and set medicine_name_and_strength to NOT NULL with proper default.
  This ensures we only have one medication name column to maintain.
*/

DO $$
BEGIN
  -- Drop the old medication_name column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_medications' AND column_name = 'medication_name'
  ) THEN
    ALTER TABLE case_medications DROP COLUMN medication_name CASCADE;
  END IF;

  -- Ensure medicine_name_and_strength is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_medications' AND column_name = 'medicine_name_and_strength'
  ) THEN
    ALTER TABLE case_medications 
    ALTER COLUMN medicine_name_and_strength SET NOT NULL,
    ALTER COLUMN medicine_name_and_strength SET DEFAULT '';
  END IF;
END $$;
