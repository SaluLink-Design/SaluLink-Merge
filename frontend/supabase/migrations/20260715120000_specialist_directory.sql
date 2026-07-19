-- Specialist directory for direct referral delivery
--
-- Problem: referring to a specific specialist today means typing their
-- specialty as free text (case_referrals.specialist_type) and manually
-- copying/sending a shareable token link — there is no way to address a
-- referral to a specific specialist's account, because profiles are RLS-
-- locked to self/same-workspace (see "Users read own profile" below) and
-- there is no directory to search.
--
-- Fix: specialists can opt in to a narrow, read-only directory (name,
-- practitioner role/speciality, workspace id — never email/phone/bhf) via a
-- SECURITY DEFINER RPC. A GP can search it when creating a referral; if a
-- match is selected, the referral's target_workspace_id is set directly at
-- creation instead of waiting for a token to be accepted. The token/link
-- flow from 20260707130000_referral_workspace_sharing.sql is unchanged and
-- remains the only path for specialists not yet in the directory.

-- ---------------------------------------------------------------------------
-- 1. Opt-in flag — directory is opt-in, not automatic, so a specialist's
--    presence on the platform never becomes discoverable without consent.
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS directory_listed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.directory_listed IS
  'Opt-in flag. When true, this profile''s name/role/speciality/workspace (never email/phone/bhf_number) is returned by search_specialist_directory() to other workspaces creating a referral.';

-- ---------------------------------------------------------------------------
-- 2. Directory search RPC — the only way to read across profiles/workspaces.
--    Deliberately narrow return columns; deliberately excludes the caller's
--    own workspace so a GP can't "refer" to themselves.
-- ---------------------------------------------------------------------------
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
    p.id AS profile_id,
    trim(concat(p.first_name, ' ', p.surname)) AS display_name,
    p.practitioner_role,
    p.speciality,
    wm.workspace_id,
    w.name AS workspace_name
  FROM profiles p
  JOIN workspace_members wm ON wm.user_id = p.id AND wm.status = 'active'
  JOIN workspaces w ON w.id = wm.workspace_id
  WHERE p.directory_listed = true
    AND p.id <> auth.uid()
    AND wm.workspace_id <> COALESCE(
      (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active' LIMIT 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    )
    AND (
      p_query = ''
      OR trim(concat(p.first_name, ' ', p.surname)) ILIKE '%' || p_query || '%'
      OR p.speciality ILIKE '%' || p_query || '%'
      OR p.practitioner_role ILIKE '%' || p_query || '%'
    )
  ORDER BY display_name
  LIMIT 20;
$$;

COMMENT ON FUNCTION search_specialist_directory(text) IS
  'Read-only, opt-in specialist lookup for referral targeting. Returns only name/role/speciality/workspace — never contact details. Excludes the caller''s own workspace.';

GRANT EXECUTE ON FUNCTION search_specialist_directory(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Let a GP set target_workspace_id directly when the referral was created
--    against a directory entry, skipping the token-acceptance round trip.
--    Only allowed at INSERT time and only to a workspace the referring GP
--    does not belong to (mirrors the accept_case_referral self-referral guard).
-- ---------------------------------------------------------------------------
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
    AND (
      target_workspace_id IS NULL
      OR NOT is_workspace_member(target_workspace_id)
    )
  );

-- Directory referrals are already resolved to a target workspace — mark the
-- token accepted immediately so ReferralInbox/outbound status reads the same
-- "accepted" state it would after a manual token acceptance, and the token
-- itself is no longer usable by anyone else who might see it in a link.
CREATE OR REPLACE FUNCTION mark_directory_referral_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_workspace_id IS NOT NULL AND NEW.token_status = 'pending' THEN
    NEW.token_status := 'accepted';
    NEW.accepted_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_mark_directory_referral_accepted ON case_referrals;
CREATE TRIGGER trg_mark_directory_referral_accepted
  BEFORE INSERT ON case_referrals
  FOR EACH ROW
  EXECUTE FUNCTION mark_directory_referral_accepted();
