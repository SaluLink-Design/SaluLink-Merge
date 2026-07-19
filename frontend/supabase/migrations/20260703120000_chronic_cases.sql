-- Chronic condition cases and care actions (future sync from caseService.ts)
-- Not wired in MVP — localStorage holds chronicCases + careActions client-side.

CREATE TABLE IF NOT EXISTS chronic_condition_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_id text NOT NULL,
  condition text NOT NULL,
  icd_code text,
  approval_path_id text,
  registration_status text NOT NULL DEFAULT 'not_started',
  submission_status text DEFAULT 'draft',
  diagnosis_date date,
  registration_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, profile_id, condition)
);

CREATE TABLE IF NOT EXISTS care_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chronic_case_id uuid NOT NULL REFERENCES chronic_condition_cases(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('registration', 'pathway', 'ongoing')),
  status text NOT NULL DEFAULT 'not_started',
  title text NOT NULL,
  purpose text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT 'gp',
  requirement_ref jsonb NOT NULL DEFAULT '{}',
  evidence jsonb DEFAULT '{}',
  treatment_item_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chronic_cases_profile ON chronic_condition_cases(profile_id);
CREATE INDEX IF NOT EXISTS idx_care_actions_chronic_case ON care_actions(chronic_case_id);

ALTER TABLE chronic_condition_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members read chronic_condition_cases" ON chronic_condition_cases;
CREATE POLICY "Workspace members read chronic_condition_cases"
  ON chronic_condition_cases FOR SELECT
  TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members insert chronic_condition_cases" ON chronic_condition_cases;
CREATE POLICY "Workspace members insert chronic_condition_cases"
  ON chronic_condition_cases FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members update chronic_condition_cases" ON chronic_condition_cases;
CREATE POLICY "Workspace members update chronic_condition_cases"
  ON chronic_condition_cases FOR UPDATE
  TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members delete chronic_condition_cases" ON chronic_condition_cases;
CREATE POLICY "Workspace members delete chronic_condition_cases"
  ON chronic_condition_cases FOR DELETE
  TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members read care_actions" ON care_actions;
CREATE POLICY "Workspace members read care_actions"
  ON care_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chronic_condition_cases c
      WHERE c.id = care_actions.chronic_case_id
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
    )
  );

DROP POLICY IF EXISTS "Workspace members insert care_actions" ON care_actions;
CREATE POLICY "Workspace members insert care_actions"
  ON care_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chronic_condition_cases c
      WHERE c.id = care_actions.chronic_case_id
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
    )
  );

DROP POLICY IF EXISTS "Workspace members update care_actions" ON care_actions;
CREATE POLICY "Workspace members update care_actions"
  ON care_actions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chronic_condition_cases c
      WHERE c.id = care_actions.chronic_case_id
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chronic_condition_cases c
      WHERE c.id = care_actions.chronic_case_id
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
    )
  );

DROP POLICY IF EXISTS "Workspace members delete care_actions" ON care_actions;
CREATE POLICY "Workspace members delete care_actions"
  ON care_actions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chronic_condition_cases c
      WHERE c.id = care_actions.chronic_case_id
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
    )
  );
