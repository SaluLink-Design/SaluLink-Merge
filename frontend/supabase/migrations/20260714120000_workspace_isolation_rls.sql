-- Workspace isolation: backfill orphan cases, tighten RLS, drop legacy anon policies.
--
-- Closes cross-account patient data leakage where workspace_id IS NULL granted
-- every authenticated user read/write access, and where pre-auth anon policies
-- remained active alongside authenticated workspace policies.

-- ---------------------------------------------------------------------------
-- 1. Backfill cases missing workspace_id from creator's active workspace
-- ---------------------------------------------------------------------------
UPDATE cases c
SET workspace_id = sub.workspace_id
FROM (
  SELECT DISTINCT ON (wm.user_id)
    wm.user_id,
    wm.workspace_id
  FROM workspace_members wm
  WHERE wm.status = 'active'
  ORDER BY wm.user_id, CASE WHEN wm.role = 'owner' THEN 0 ELSE 1 END, wm.created_at
) sub
WHERE c.workspace_id IS NULL
  AND c.created_by IS NOT NULL
  AND c.created_by = sub.user_id;

COMMENT ON TABLE cases IS
  'Patient cases scoped to a workspace. Rows with NULL workspace_id after backfill '
  'are orphaned and inaccessible until manually assigned — do not reintroduce '
  'NULL-bypass RLS policies.';

-- ---------------------------------------------------------------------------
-- 2. Drop legacy anon (public) policies from pre-auth development
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access to cases" ON cases;
DROP POLICY IF EXISTS "Allow public insert to cases" ON cases;
DROP POLICY IF EXISTS "Allow public update to cases" ON cases;
DROP POLICY IF EXISTS "Allow public delete from cases" ON cases;

DROP POLICY IF EXISTS "Allow public read access to case_conditions" ON case_conditions;
DROP POLICY IF EXISTS "Allow public insert to case_conditions" ON case_conditions;
DROP POLICY IF EXISTS "Allow public update to case_conditions" ON case_conditions;
DROP POLICY IF EXISTS "Allow public delete from case_conditions" ON case_conditions;

DROP POLICY IF EXISTS "Allow public read access to case_medications" ON case_medications;
DROP POLICY IF EXISTS "Allow public insert to case_medications" ON case_medications;
DROP POLICY IF EXISTS "Allow public update to case_medications" ON case_medications;
DROP POLICY IF EXISTS "Allow public delete from case_medications" ON case_medications;

DROP POLICY IF EXISTS "Allow public read access to case_diagnostics" ON case_diagnostics;
DROP POLICY IF EXISTS "Allow public insert to case_diagnostics" ON case_diagnostics;
DROP POLICY IF EXISTS "Allow public update to case_diagnostics" ON case_diagnostics;
DROP POLICY IF EXISTS "Allow public delete from case_diagnostics" ON case_diagnostics;

DROP POLICY IF EXISTS "Allow public read access to case_referrals" ON case_referrals;
DROP POLICY IF EXISTS "Allow public insert to case_referrals" ON case_referrals;
DROP POLICY IF EXISTS "Allow public update to case_referrals" ON case_referrals;
DROP POLICY IF EXISTS "Allow public delete from case_referrals" ON case_referrals;

DROP POLICY IF EXISTS "Allow public read access to case_diagnostic_treatments" ON case_diagnostic_treatments;
DROP POLICY IF EXISTS "Allow public insert to case_diagnostic_treatments" ON case_diagnostic_treatments;
DROP POLICY IF EXISTS "Allow public update to case_diagnostic_treatments" ON case_diagnostic_treatments;
DROP POLICY IF EXISTS "Allow public delete from case_diagnostic_treatments" ON case_diagnostic_treatments;

DROP POLICY IF EXISTS "Allow public read access to case_ongoing_treatments" ON case_ongoing_treatments;
DROP POLICY IF EXISTS "Allow public insert to case_ongoing_treatments" ON case_ongoing_treatments;
DROP POLICY IF EXISTS "Allow public update to case_ongoing_treatments" ON case_ongoing_treatments;
DROP POLICY IF EXISTS "Allow public delete from case_ongoing_treatments" ON case_ongoing_treatments;

-- ---------------------------------------------------------------------------
-- 3. Tighten cases RLS — no NULL workspace_id bypass
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace members read cases" ON cases;
CREATE POLICY "Workspace members read cases"
  ON cases FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id) OR is_case_referral_recipient(id));

DROP POLICY IF EXISTS "Workspace members insert cases" ON cases;
CREATE POLICY "Workspace members insert cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IS NOT NULL AND is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members update cases" ON cases;
CREATE POLICY "Workspace members update cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (is_workspace_member(workspace_id) OR is_case_referral_recipient(id))
  WITH CHECK (is_workspace_member(workspace_id) OR is_case_referral_recipient(id));

DROP POLICY IF EXISTS "Workspace members delete cases" ON cases;
CREATE POLICY "Workspace members delete cases"
  ON cases FOR DELETE
  TO authenticated
  USING (is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- 4. Tighten child-table RLS — no NULL workspace_id bypass on parent case
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'case_conditions',
    'case_medications',
    'case_diagnostics',
    'case_diagnostic_treatments',
    'case_ongoing_treatments'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Workspace or referral reads %1$s" ON %1$I', t);
    EXECUTE format(
      'CREATE POLICY "Workspace or referral reads %1$s" ON %1$I FOR SELECT TO authenticated USING (
         is_case_referral_recipient(case_id)
         OR EXISTS (
           SELECT 1 FROM cases c
           WHERE c.id = %1$I.case_id
             AND c.workspace_id IS NOT NULL
             AND is_workspace_member(c.workspace_id)
         )
       )', t
    );

    EXECUTE format('DROP POLICY IF EXISTS "Workspace or referral inserts %1$s" ON %1$I', t);
    EXECUTE format(
      'CREATE POLICY "Workspace or referral inserts %1$s" ON %1$I FOR INSERT TO authenticated WITH CHECK (
         is_case_referral_recipient(case_id)
         OR EXISTS (
           SELECT 1 FROM cases c
           WHERE c.id = %1$I.case_id
             AND c.workspace_id IS NOT NULL
             AND is_workspace_member(c.workspace_id)
         )
       )', t
    );

    EXECUTE format('DROP POLICY IF EXISTS "Workspace or referral updates %1$s" ON %1$I', t);
    EXECUTE format(
      'CREATE POLICY "Workspace or referral updates %1$s" ON %1$I FOR UPDATE TO authenticated USING (
         is_case_referral_recipient(case_id)
         OR EXISTS (
           SELECT 1 FROM cases c
           WHERE c.id = %1$I.case_id
             AND c.workspace_id IS NOT NULL
             AND is_workspace_member(c.workspace_id)
         )
       ) WITH CHECK (
         is_case_referral_recipient(case_id)
         OR EXISTS (
           SELECT 1 FROM cases c
           WHERE c.id = %1$I.case_id
             AND c.workspace_id IS NOT NULL
             AND is_workspace_member(c.workspace_id)
         )
       )', t
    );

    EXECUTE format('DROP POLICY IF EXISTS "Workspace or referral deletes %1$s" ON %1$I', t);
    EXECUTE format(
      'CREATE POLICY "Workspace or referral deletes %1$s" ON %1$I FOR DELETE TO authenticated USING (
         is_case_referral_recipient(case_id)
         OR EXISTS (
           SELECT 1 FROM cases c
           WHERE c.id = %1$I.case_id
             AND c.workspace_id IS NOT NULL
             AND is_workspace_member(c.workspace_id)
         )
       )', t
    );
  END LOOP;
END $$;

-- case_referrals: parent case must belong to a workspace (no NULL bypass)
DROP POLICY IF EXISTS "Referring or target workspace reads referrals" ON case_referrals;
CREATE POLICY "Referring or target workspace reads referrals"
  ON case_referrals FOR SELECT
  TO authenticated
  USING (
    is_case_referral_recipient(case_id)
    OR EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_referrals.case_id
        AND c.workspace_id IS NOT NULL
        AND is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Referring workspace creates referrals" ON case_referrals;
CREATE POLICY "Referring workspace creates referrals"
  ON case_referrals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_referrals.case_id
        AND c.workspace_id IS NOT NULL
        AND is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "Referring or target workspace updates referrals" ON case_referrals;
CREATE POLICY "Referring or target workspace updates referrals"
  ON case_referrals FOR UPDATE
  TO authenticated
  USING (
    is_case_referral_recipient(case_id)
    OR EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_referrals.case_id
        AND c.workspace_id IS NOT NULL
        AND is_workspace_member(c.workspace_id)
    )
  )
  WITH CHECK (
    is_case_referral_recipient(case_id)
    OR EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_referrals.case_id
        AND c.workspace_id IS NOT NULL
        AND is_workspace_member(c.workspace_id)
    )
  );
