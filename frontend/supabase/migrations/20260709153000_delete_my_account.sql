-- True account deletion for self-service flows.
-- Removes dependent workspace/case data then deletes auth.users row so the
-- email can be reused for signup.

CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Gather workspaces the caller owns.
  CREATE TEMP TABLE tmp_owned_workspaces ON COMMIT DROP AS
  SELECT w.id AS workspace_id
  FROM workspaces w
  WHERE w.owner_id = v_user_id;

  -- Gather cases inside owned workspaces.
  CREATE TEMP TABLE tmp_owned_cases ON COMMIT DROP AS
  SELECT c.id AS case_id
  FROM cases c
  WHERE c.workspace_id IN (SELECT workspace_id FROM tmp_owned_workspaces);

  -- Case-scoped children (explicit delete order avoids FK surprises).
  DELETE FROM case_referrals
  WHERE case_id IN (SELECT case_id FROM tmp_owned_cases)
     OR referring_workspace_id IN (SELECT workspace_id FROM tmp_owned_workspaces)
     OR target_workspace_id IN (SELECT workspace_id FROM tmp_owned_workspaces)
     OR accepted_by = v_user_id;

  DELETE FROM case_medications
  WHERE case_id IN (SELECT case_id FROM tmp_owned_cases);

  DELETE FROM case_diagnostics
  WHERE case_id IN (SELECT case_id FROM tmp_owned_cases);

  DELETE FROM case_diagnostic_treatments
  WHERE case_id IN (SELECT case_id FROM tmp_owned_cases);

  DELETE FROM case_ongoing_treatments
  WHERE case_id IN (SELECT case_id FROM tmp_owned_cases);

  DELETE FROM case_conditions
  WHERE case_id IN (SELECT case_id FROM tmp_owned_cases);

  DELETE FROM cases
  WHERE id IN (SELECT case_id FROM tmp_owned_cases);

  -- Workspace-scoped rows.
  DELETE FROM workspace_invites
  WHERE workspace_id IN (SELECT workspace_id FROM tmp_owned_workspaces);

  DELETE FROM workspace_members
  WHERE workspace_id IN (SELECT workspace_id FROM tmp_owned_workspaces)
     OR user_id = v_user_id;

  DELETE FROM workspaces
  WHERE id IN (SELECT workspace_id FROM tmp_owned_workspaces);

  -- Profile row mirrors auth.users id.
  DELETE FROM profiles
  WHERE id = v_user_id;

  -- Final identity delete: this is what frees the email for reuse.
  DELETE FROM auth.users
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;

COMMENT ON FUNCTION delete_my_account() IS
  'Deletes current authenticated user, owned workspace/case data, and profile so email can be reused.';
