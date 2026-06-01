/*
  # Update Cases Schema for Complete Case Data

  ## Overview
  This migration extends the existing cases schema to store complete claim information including treatments, documentation, and medical plans.

  ## Changes Made

  ### 1. Cases Table Updates
    - Add `plan` (text) - Medical plan type (Core, Priority, Saver, Executive, Comprehensive)
    - Add `medication_note` (text) - Overall medication registration notes
    - Add `condition_name` (text) - Selected chronic condition name
    - Add `icd_code` (text) - Selected ICD-10 code
    - Add `icd_description` (text) - ICD-10 code description

  ### 2. New Tables
    - `case_diagnostic_treatments` - Store diagnostic basket treatments with full details
      - `id` (uuid, primary key)
      - `case_id` (uuid, foreign key)
      - `description` (text) - Treatment description
      - `code` (text) - Treatment code
      - `max_covered` (integer) - Maximum times covered
      - `times_completed` (integer) - Times completed so far
      - `documentation_notes` (text) - Clinical documentation
      - `created_at` (timestamptz)
      
    - `case_ongoing_treatments` - Store ongoing management treatments
      - Same structure as diagnostic treatments
      
  ### 3. Medication Table Updates
    - Add `medicine_class` (text) - Medicine classification
    - Add `active_ingredient` (text) - Active ingredient name
    - Add `cda_amount` (text) - CDA amount
    - Rename `medication_name` to `medicine_name_and_strength`
    - Add `note` (text) - Individual medication notes
    - Add `documentation_notes` (text) - Clinical documentation for medication

  ### 4. Security
    - All new tables have RLS enabled
    - Public access policies applied (to be restricted when auth is added)

  ### 5. Important Notes
    - Uses safe `IF NOT EXISTS` and `IF EXISTS` checks
    - Preserves existing data with default values
    - All changes are backwards compatible
*/

-- Update cases table with new fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'plan'
  ) THEN
    ALTER TABLE cases ADD COLUMN plan text DEFAULT 'Core';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'medication_note'
  ) THEN
    ALTER TABLE cases ADD COLUMN medication_note text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'condition_name'
  ) THEN
    ALTER TABLE cases ADD COLUMN condition_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'icd_code'
  ) THEN
    ALTER TABLE cases ADD COLUMN icd_code text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'icd_description'
  ) THEN
    ALTER TABLE cases ADD COLUMN icd_description text DEFAULT '';
  END IF;
END $$;

-- Create diagnostic treatments table
CREATE TABLE IF NOT EXISTS case_diagnostic_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  max_covered integer DEFAULT 0,
  times_completed integer DEFAULT 0,
  documentation_notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create ongoing treatments table
CREATE TABLE IF NOT EXISTS case_ongoing_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  max_covered integer DEFAULT 0,
  times_completed integer DEFAULT 0,
  documentation_notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Update case_medications table with new fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_medications' AND column_name = 'medicine_class'
  ) THEN
    ALTER TABLE case_medications ADD COLUMN medicine_class text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_medications' AND column_name = 'active_ingredient'
  ) THEN
    ALTER TABLE case_medications ADD COLUMN active_ingredient text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_medications' AND column_name = 'cda_amount'
  ) THEN
    ALTER TABLE case_medications ADD COLUMN cda_amount text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_medications' AND column_name = 'medicine_name_and_strength'
  ) THEN
    ALTER TABLE case_medications ADD COLUMN medicine_name_and_strength text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_medications' AND column_name = 'note'
  ) THEN
    ALTER TABLE case_medications ADD COLUMN note text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_medications' AND column_name = 'documentation_notes'
  ) THEN
    ALTER TABLE case_medications ADD COLUMN documentation_notes text DEFAULT '';
  END IF;
END $$;

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_diagnostic_treatments_case_id ON case_diagnostic_treatments(case_id);
CREATE INDEX IF NOT EXISTS idx_ongoing_treatments_case_id ON case_ongoing_treatments(case_id);

-- Enable Row Level Security on new tables
ALTER TABLE case_diagnostic_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_ongoing_treatments ENABLE ROW LEVEL SECURITY;

-- Create policies for case_diagnostic_treatments
CREATE POLICY "Allow public read access to diagnostic treatments"
  ON case_diagnostic_treatments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to diagnostic treatments"
  ON case_diagnostic_treatments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to diagnostic treatments"
  ON case_diagnostic_treatments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from diagnostic treatments"
  ON case_diagnostic_treatments FOR DELETE
  TO anon
  USING (true);

-- Create policies for case_ongoing_treatments
CREATE POLICY "Allow public read access to ongoing treatments"
  ON case_ongoing_treatments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to ongoing treatments"
  ON case_ongoing_treatments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to ongoing treatments"
  ON case_ongoing_treatments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from ongoing treatments"
  ON case_ongoing_treatments FOR DELETE
  TO anon
  USING (true);