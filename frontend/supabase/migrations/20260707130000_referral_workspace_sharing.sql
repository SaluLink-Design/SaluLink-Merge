-- Cross-workspace referral sharing
--
-- Problem: cases/case_* rows are scoped to exactly one workspace_id, so a GP
-- and a specialist in two separate Supabase accounts (two separate
-- workspaces) can never see the same case. The GP-workspace "shared care"
-- panels (SpecialistOutcomePanel etc.) only worked when one logged-in user
-- role-played both sides inside their own workspace.
--
-- Fix: referrals become a scoped, revocable access grant between two
-- workspaces (referring + target), not a workspace merge. A GP creates a
-- referral and gets a token; the specialist's own account/workspace accepts
-- that token (same pattern as accept_workspace_invite) which binds
-- target_workspace_id. From then on, RLS grants the target workspace read
-- and write access to that ONE case (and only that case) via
-- is_case_referral_recipient(), while the GP keeps full ownership via the
-- existing is_workspace_member() check.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Referral sharing columns
-- ---------------------------------------------------------------------------
ALTER TABLE case_referrals
  ADD COLUMN IF NOT EXISTS referring_workspace_id uuid REFERENCES workspaces(id),
  ADD COLUMN IF NOT EXISTS target_workspace_id uuid REFERENCES workspaces(id),
  ADD COLUMN IF NOT EXISTS referral_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS token_status text NOT NULL DEFAULT 'pending'
    CHECK (token_status IN ('pending', 'accepted', 'revoked')),
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_case_referrals_target_workspace ON case_referrals(target_workspace_id);
CREATE INDEX IF NOT EXISTS idx_case_referrals_referring_workspace ON case_referrals(referring_workspace_id);
CREATE INDEX IF NOT EXISTS idx_case_referrals_token ON case_referrals(referral_token);

COMMENT ON COLUMN case_referrals.referring_workspace_id IS
  'Workspace that created the referral (usually the GP practice). Auto-set from cases.workspace_id.';
COMMENT ON COLUMN case_referrals.target_workspace_id IS
  'Workspace that accepted the referral token (the specialist practice). NULL until accepted.';
COMMENT ON COLUMN case_referrals.referral_token IS
  'Shareable, single-use-to-accept token. Sent to the specialist out of band (link/email).';

-- Backfill referring_workspace_id for any pre-existing rows
UPDATE case_referrals r
SET referring_workspace_id = c.workspace_id
FROM cases c
WHERE r.case_id = c.id
  AND r.referring_workspace_id IS NULL
  AND c.workspace_id IS NOT NULL;

-- Auto-populate referring_workspace_id on insert so callers never have to pass it
CREATE OR REPLACE FUNCTION set_referral_referring_workspace()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referring_workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.referring_workspace_id FROM cases WHERE id = NEW.case_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_referral_referring_workspace ON case_referrals;
CREATE TRIGGER trg_set_referral_referring_workspace
  BEFORE INSERT ON case_referrals
  FOR EACH ROW
  EXECUTE FUNCTION set_referral_referring_workspace();

-- ---------------------------------------------------------------------------
-- 2. Access-grant helper — the core of cross-workspace sharing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_case_referral_recipient(target_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM case_referrals r
    WHERE r.case_id = target_case_id
      AND r.target_workspace_id IS NOT NULL
      AND is_workspace_member(r.target_workspace_id)
  );
$$;

COMMENT ON FUNCTION is_case_referral_recipient(uuid) IS
  'True when the current user belongs to a workspace that has accepted a referral for this case. Grants scoped, per-case access without merging workspaces.';

-- ---------------------------------------------------------------------------
-- 3. accept_case_referral RPC — same shape as accept_workspace_invite
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_case_referral(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref case_referrals%ROWTYPE;
  caller_workspace_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO ref
  FROM case_referrals
  WHERE referral_token = p_token
    AND token_status = 'pending'
    AND (token_expires_at IS NULL OR token_expires_at > now())
  LIMIT 1;

  IF ref.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired referral link';
  END IF;

  SELECT workspace_id INTO caller_workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  IF caller_workspace_id IS NULL THEN
    RAISE EXCEPTION 'You must complete your practice workspace setup before accepting a referral';
  END IF;

  IF caller_workspace_id = ref.referring_workspace_id THEN
    RAISE EXCEPTION 'The referring practice cannot accept its own referral';
  END IF;

  UPDATE case_referrals
  SET target_workspace_id = caller_workspace_id,
      token_status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now()
  WHERE id = ref.id;

  RETURN ref.case_id;
END;
$$;

COMMENT ON FUNCTION accept_case_referral(text) IS
  'Specialist-side accept: binds the caller''s own workspace as target_workspace_id for a pending referral, granting scoped access to that one case.';

-- ---------------------------------------------------------------------------
-- 4. Extend RLS: workspace member OR referral recipient
--    Also closes a pre-existing gap — case_conditions / case_medications /
--    case_diagnostics / case_diagnostic_treatments / case_ongoing_treatments
--    only ever had `TO anon` policies, never `TO authenticated`, so signed-in
--    users had no working policy on those tables at all.
-- ---------------------------------------------------------------------------

-- cases: add referral-recipient access alongside existing workspace-member access
DROP POLICY IF EXISTS "Workspace members read cases" ON cases;
CREATE POLICY "Workspace members read cases"
  ON cases FOR SELECT
  TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id) OR is_case_referral_recipient(id));

DROP POLICY IF EXISTS "Workspace members update cases" ON cases;
CREATE POLICY "Workspace members update cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id) OR is_case_referral_recipient(id))
  WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id) OR is_case_referral_recipient(id));

-- case_referrals: authenticated policies (previously anon-only)
DROP POLICY IF EXISTS "Referring or target workspace reads referrals" ON case_referrals;
CREATE POLICY "Referring or target workspace reads referrals"
  ON case_referrals FOR SELECT
  TO authenticated
  USING (
    is_case_referral_recipient(case_id)
    OR EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_referrals.case_id
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
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
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
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
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
    )
  )
  WITH CHECK (
    is_case_referral_recipient(case_id)
    OR EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_referrals.case_id
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
    )
  );

-- Shared helper pattern for the remaining per-case child tables
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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'DROP POLICY IF EXISTS "Workspace or referral reads %1$s" ON %1$I', t
    );
    EXECUTE format(
      'CREATE POLICY "Workspace or referral reads %1$s" ON %1$I FOR SELECT TO authenticated USING (
         is_case_referral_recipient(case_id)
         OR EXISTS (SELECT 1 FROM cases c WHERE c.id = %1$I.case_id AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)))
       )', t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS "Workspace or referral inserts %1$s" ON %1$I', t
    );
    EXECUTE format(
      'CREATE POLICY "Workspace or referral inserts %1$s" ON %1$I FOR INSERT TO authenticated WITH CHECK (
         is_case_referral_recipient(case_id)
         OR EXISTS (SELECT 1 FROM cases c WHERE c.id = %1$I.case_id AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)))
       )', t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS "Workspace or referral updates %1$s" ON %1$I', t
    );
    EXECUTE format(
      'CREATE POLICY "Workspace or referral updates %1$s" ON %1$I FOR UPDATE TO authenticated USING (
         is_case_referral_recipient(case_id)
         OR EXISTS (SELECT 1 FROM cases c WHERE c.id = %1$I.case_id AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)))
       ) WITH CHECK (
         is_case_referral_recipient(case_id)
         OR EXISTS (SELECT 1 FROM cases c WHERE c.id = %1$I.case_id AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)))
       )', t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS "Workspace or referral deletes %1$s" ON %1$I', t
    );
    EXECUTE format(
      'CREATE POLICY "Workspace or referral deletes %1$s" ON %1$I FOR DELETE TO authenticated USING (
         is_case_referral_recipient(case_id)
         OR EXISTS (SELECT 1 FROM cases c WHERE c.id = %1$I.case_id AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)))
       )', t
    );
  END LOOP;
END $$;

-- chronic_condition_cases / care_actions are intentionally NOT extended here.
-- That table has no case_id column (it's keyed by workspace_id + profile_id +
-- condition, and is not even wired to Supabase yet — the CIB wizard runs on
-- localStorage/Zustand per browser, see the file header comment on
-- 20260703120000_chronic_cases.sql). Granting access "because some case in
-- this workspace was referred" would leak every other chronic case in the
-- GP's workspace to the specialist, which is the exact workspace-merge
-- mistake this migration exists to avoid. Real cross-workspace sharing of
-- wizard state (interpretation notes, ICD selection, medication, CIB phase)
-- requires adding a case_id FK to chronic_condition_cases and wiring the
-- Zustand store to Supabase first — tracked as follow-up, not done here.
COMMENT ON TABLE chronic_condition_cases IS
  'Workspace-scoped CIB wizard state. No case_id FK yet, so it cannot be safely '
  'shared per-referral — see migration 20260707130000 for why it is excluded '
  'from cross-workspace referral access.';
