/*
  # SaluLink Chronic Conditions Database Schema

  1. New Tables
    - `cases`
      - `id` (uuid, primary key) - Unique case identifier
      - `patient_name` (text) - Patient name
      - `patient_id` (text) - Patient medical record number
      - `clinical_note` (text) - Original clinical note
      - `extracted_keywords` (jsonb) - Keywords extracted by ClinicalBERT
      - `created_at` (timestamptz) - Case creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `status` (text) - Case status (draft, submitted, archived)
      
    - `case_conditions`
      - `id` (uuid, primary key)
      - `case_id` (uuid, foreign key) - Reference to cases table
      - `condition_name` (text) - Chronic condition name
      - `icd_code` (text) - ICD-10 code
      - `icd_description` (text) - ICD code description
      - `similarity_score` (numeric) - AI similarity score
      - `created_at` (timestamptz)
      
    - `case_medications`
      - `id` (uuid, primary key)
      - `case_id` (uuid, foreign key)
      - `medication_name` (text)
      - `nappi_code` (text)
      - `quantity` (integer)
      - `dosage` (text)
      - `created_at` (timestamptz)
      
    - `case_diagnostics`
      - `id` (uuid, primary key)
      - `case_id` (uuid, foreign key)
      - `test_name` (text)
      - `test_code` (text)
      - `category` (text)
      - `created_at` (timestamptz)
      
    - `case_referrals`
      - `id` (uuid, primary key)
      - `case_id` (uuid, foreign key)
      - `specialist_type` (text)
      - `urgency` (text)
      - `notes` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (since no auth is implemented yet)
    - Can be restricted later when authentication is added

  3. Notes
    - All tables use UUID primary keys
    - Timestamps track creation and updates
    - JSONB used for flexible keyword storage
    - Foreign keys maintain referential integrity
*/

-- Create cases table
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL DEFAULT '',
  patient_id text NOT NULL DEFAULT '',
  clinical_note text NOT NULL,
  extracted_keywords jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status text DEFAULT 'draft'
);

-- Create case_conditions table
CREATE TABLE IF NOT EXISTS case_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  condition_name text NOT NULL,
  icd_code text NOT NULL,
  icd_description text NOT NULL,
  similarity_score numeric(5,4) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create case_medications table
CREATE TABLE IF NOT EXISTS case_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  medication_name text NOT NULL,
  nappi_code text NOT NULL DEFAULT '',
  quantity integer DEFAULT 1,
  dosage text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create case_diagnostics table
CREATE TABLE IF NOT EXISTS case_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  test_name text NOT NULL,
  test_code text NOT NULL DEFAULT '',
  category text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create case_referrals table
CREATE TABLE IF NOT EXISTS case_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  specialist_type text NOT NULL,
  urgency text DEFAULT 'routine',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_conditions_case_id ON case_conditions(case_id);
CREATE INDEX IF NOT EXISTS idx_case_medications_case_id ON case_medications(case_id);
CREATE INDEX IF NOT EXISTS idx_case_diagnostics_case_id ON case_diagnostics(case_id);
CREATE INDEX IF NOT EXISTS idx_case_referrals_case_id ON case_referrals(case_id);

-- Enable Row Level Security
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_referrals ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (temporary - restrict when auth is added)
CREATE POLICY "Allow public read access to cases"
  ON cases FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to cases"
  ON cases FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to cases"
  ON cases FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from cases"
  ON cases FOR DELETE
  TO anon
  USING (true);

-- Policies for case_conditions
CREATE POLICY "Allow public read access to case_conditions"
  ON case_conditions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to case_conditions"
  ON case_conditions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to case_conditions"
  ON case_conditions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from case_conditions"
  ON case_conditions FOR DELETE
  TO anon
  USING (true);

-- Policies for case_medications
CREATE POLICY "Allow public read access to case_medications"
  ON case_medications FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to case_medications"
  ON case_medications FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to case_medications"
  ON case_medications FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from case_medications"
  ON case_medications FOR DELETE
  TO anon
  USING (true);

-- Policies for case_diagnostics
CREATE POLICY "Allow public read access to case_diagnostics"
  ON case_diagnostics FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to case_diagnostics"
  ON case_diagnostics FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to case_diagnostics"
  ON case_diagnostics FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from case_diagnostics"
  ON case_diagnostics FOR DELETE
  TO anon
  USING (true);

-- Policies for case_referrals
CREATE POLICY "Allow public read access to case_referrals"
  ON case_referrals FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to case_referrals"
  ON case_referrals FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to case_referrals"
  ON case_referrals FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from case_referrals"
  ON case_referrals FOR DELETE
  TO anon
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cases table
DROP TRIGGER IF EXISTS update_cases_updated_at ON cases;
CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
