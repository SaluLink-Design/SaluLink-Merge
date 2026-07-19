/* Harden direct specialist delivery and expose an auditable referral lifecycle. */

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_directory_role_check;

-- Older UI versions exposed the opt-in checkbox to every practitioner role.
-- Clear invalid legacy opt-ins before enforcing the specialist-only rule.
UPDATE profiles
SET directory_listed = false
WHERE directory_listed = true
  AND practitioner_role NOT IN ('neurologist', 'specialist', 'clinical_technologist', 'pathologist');

ALTER TABLE profiles
  ADD CONSTRAINT profiles_directory_role_check
  CHECK (
    directory_listed = false
    OR practitioner_role IN ('neurologist', 'specialist', 'clinical_technologist', 'pathologist')
  );

CREATE INDEX IF NOT EXISTS idx_profiles_listed_specialists
  ON profiles (practitioner_role, speciality)
  WHERE directory_listed = true;

CREATE OR REPLACE FUNCTION search_specialist_directory(p_query text DEFAULT '')
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  practitioner_role text,
  speciality text,
  workspace_id uuid,
  workspace_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    trim(concat(p.first_name, ' ', p.surname)),
    p.practitioner_role,
    p.speciality,
    wm.workspace_id,
    w.name
  FROM profiles p
  JOIN workspace_members wm
    ON wm.user_id = p.id
   AND wm.status = 'active'
  JOIN workspaces w ON w.id = wm.workspace_id
  WHERE auth.uid() IS NOT NULL
    AND p.directory_listed = true
    AND p.practitioner_role IN ('neurologist', 'specialist', 'clinical_technologist', 'pathologist')
    AND p.id <> auth.uid()
    AND NOT is_workspace_member(wm.workspace_id)
    AND (
      trim(COALESCE(p_query, '')) = ''
      OR trim(concat(p.first_name, ' ', p.surname)) ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(p.speciality, '') ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(p.practitioner_role, '') ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY trim(concat(p.first_name, ' ', p.surname))
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION search_specialist_directory(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_specialist_directory(text) TO authenticated;

DROP POLICY IF EXISTS "Referring workspace creates referrals" ON case_referrals;
CREATE POLICY "Referring workspace creates referrals"
  ON case_referrals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM cases c
      WHERE c.id = case_referrals.case_id
        AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
    )
    AND (
      target_workspace_id IS NULL
      OR (
        NOT is_workspace_member(target_workspace_id)
        AND EXISTS (
          SELECT 1
          FROM workspace_members wm
          JOIN profiles p ON p.id = wm.user_id
          WHERE wm.workspace_id = target_workspace_id
            AND wm.status = 'active'
            AND p.directory_listed = true
            AND p.practitioner_role IN (
              'neurologist',
              'specialist',
              'clinical_technologist',
              'pathologist'
            )
        )
      )
    )
  );

-- Use a validated SECURITY DEFINER function for referral creation. Direct
-- inserts are brittle because the target-workspace check crosses RLS-protected
-- profiles/workspace membership tables. This function performs the same checks
-- explicitly without exposing either table to the caller.
CREATE OR REPLACE FUNCTION create_case_referral(
  p_case_id uuid,
  p_specialist_type text,
  p_urgency text,
  p_notes text,
  p_care_ownership text DEFAULT 'pending_decision',
  p_target_workspace_id uuid DEFAULT NULL
)
RETURNS TABLE (referral_id uuid, referral_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id uuid;
  inserted_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_urgency NOT IN ('routine', 'urgent', 'emergency') THEN
    RAISE EXCEPTION 'Invalid referral urgency';
  END IF;

  IF p_care_ownership NOT IN ('pending_decision', 'gp_retained', 'specialist_accepted') THEN
    RAISE EXCEPTION 'Invalid care ownership state';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM cases c
    WHERE c.id = p_case_id
      AND (c.workspace_id IS NULL OR is_workspace_member(c.workspace_id))
  ) THEN
    RAISE EXCEPTION 'You do not have permission to refer this case';
  END IF;

  IF p_target_workspace_id IS NOT NULL THEN
    IF is_workspace_member(p_target_workspace_id) THEN
      RAISE EXCEPTION 'A practice cannot refer a case to itself';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM workspace_members wm
      JOIN profiles p ON p.id = wm.user_id
      WHERE wm.workspace_id = p_target_workspace_id
        AND wm.status = 'active'
        AND p.directory_listed = true
        AND p.practitioner_role IN (
          'neurologist',
          'specialist',
          'clinical_technologist',
          'pathologist'
        )
    ) THEN
      RAISE EXCEPTION 'The selected specialist is no longer available for direct referral';
    END IF;
  END IF;

  INSERT INTO case_referrals AS created (
    case_id,
    specialist_type,
    urgency,
    notes,
    care_ownership,
    target_workspace_id
  )
  VALUES (
    p_case_id,
    trim(p_specialist_type),
    p_urgency,
    trim(p_notes),
    p_care_ownership,
    p_target_workspace_id
  )
  RETURNING created.id, created.referral_token
  INTO inserted_id, inserted_token;

  RETURN QUERY SELECT inserted_id, inserted_token;
END;
$$;

REVOKE ALL ON FUNCTION create_case_referral(uuid, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_case_referral(uuid, text, text, text, text, uuid) TO authenticated;

ALTER TABLE case_referrals
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN case_referrals.opened_at IS
  'First time a member of the target specialist workspace opened the referral.';

CREATE INDEX IF NOT EXISTS idx_case_referrals_target_unopened
  ON case_referrals (target_workspace_id, created_at DESC)
  WHERE opened_at IS NULL AND registration_completed_at IS NULL;

CREATE OR REPLACE FUNCTION keep_referral_progress_consistent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.registration_completed_at IS NOT NULL THEN
    NEW.opened_at := COALESCE(NEW.opened_at, NEW.registration_completed_at);
    NEW.opened_by := COALESCE(NEW.opened_by, NEW.registration_completed_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_keep_referral_progress_consistent ON case_referrals;
CREATE TRIGGER trg_keep_referral_progress_consistent
  BEFORE INSERT OR UPDATE ON case_referrals
  FOR EACH ROW
  EXECUTE FUNCTION keep_referral_progress_consistent();

CREATE OR REPLACE FUNCTION mark_referral_opened(p_referral_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opened_stamp timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE case_referrals r
  SET opened_at = COALESCE(r.opened_at, now()),
      opened_by = COALESCE(r.opened_by, auth.uid())
  WHERE r.id = p_referral_id
    AND r.target_workspace_id IS NOT NULL
    AND is_workspace_member(r.target_workspace_id)
  RETURNING r.opened_at INTO opened_stamp;

  IF opened_stamp IS NULL THEN
    RAISE EXCEPTION 'Referral not found in your workspace';
  END IF;

  RETURN opened_stamp;
END;
$$;

REVOKE ALL ON FUNCTION mark_referral_opened(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_referral_opened(uuid) TO authenticated;
