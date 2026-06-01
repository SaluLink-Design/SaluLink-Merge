-- SaluLink Supabase Schema Setup
-- Copy and paste this entire file into Supabase SQL Editor
-- https://homkufroaufrejnpnawf.supabase.co/project/_/sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Root cases table
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL DEFAULT '',
  patient_id text NOT NULL DEFAULT '',
  patient_email text DEFAULT '',
  patient_phone text DEFAULT '',
  medical_aid_number text DEFAULT '',
  clinical_note text NOT NULL,
  extracted_keywords jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status text DEFAULT 'draft',
  plan text DEFAULT 'Core',
  medication_note text DEFAULT '',
  condition_name text DEFAULT '',
  icd_code text DEFAULT '',
  icd_description text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);

-- Conditions detected for a case
CREATE TABLE IF NOT EXISTS case_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  condition_name text NOT NULL,
  icd_code text NOT NULL,
  icd_description text NOT NULL,
  similarity_score numeric(5,4) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_conditions_case_id ON case_conditions(case_id);

-- Medications saved for a case
CREATE TABLE IF NOT EXISTS case_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  medicine_class text DEFAULT '',
  active_ingredient text DEFAULT '',
  medicine_name_and_strength text NOT NULL DEFAULT '',
  nappi_code text NOT NULL DEFAULT '',
  cda_amount text DEFAULT '',
  quantity integer DEFAULT 1,
  dosage text DEFAULT '',
  note text DEFAULT '',
  documentation_notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_medications_case_id ON case_medications(case_id);

-- Legacy diagnostic table kept for compatibility if present
CREATE TABLE IF NOT EXISTS case_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  test_name text NOT NULL,
  test_code text NOT NULL DEFAULT '',
  category text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_diagnostics_case_id ON case_diagnostics(case_id);

-- Referral records for a case
CREATE TABLE IF NOT EXISTS case_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  specialist_type text NOT NULL,
  urgency text DEFAULT 'routine',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_referrals_case_id ON case_referrals(case_id);

-- Diagnostic treatment details
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

CREATE INDEX IF NOT EXISTS idx_diagnostic_treatments_case_id ON case_diagnostic_treatments(case_id);

-- Ongoing treatment details
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

CREATE INDEX IF NOT EXISTS idx_ongoing_treatments_case_id ON case_ongoing_treatments(case_id);

-- Enable row-level security for all tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_diagnostic_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_ongoing_treatments ENABLE ROW LEVEL SECURITY;

-- Public RLS policies for development / current unauthenticated access model
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

CREATE POLICY "Allow public read access to case_conditions"
  ON case_conditions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to case_conditions"
  ON case_conditions FOR INSERT
  TO anon
  WITH CHECK (true);

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

CREATE POLICY "Allow public read access to case_diagnostic_treatments"
  ON case_diagnostic_treatments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to case_diagnostic_treatments"
  ON case_diagnostic_treatments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to case_diagnostic_treatments"
  ON case_diagnostic_treatments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from case_diagnostic_treatments"
  ON case_diagnostic_treatments FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to case_ongoing_treatments"
  ON case_ongoing_treatments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to case_ongoing_treatments"
  ON case_ongoing_treatments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to case_ongoing_treatments"
  ON case_ongoing_treatments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from case_ongoing_treatments"
  ON case_ongoing_treatments FOR DELETE
  TO anon
  USING (true);
