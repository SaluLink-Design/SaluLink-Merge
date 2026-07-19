-- Run this once in Supabase Dashboard → SQL Editor → New query → Run
-- Project: homkufroaufrejnpnawf
-- Creates: profiles, workspaces, workspace_members, workspace_invites + case columns

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  surname text NOT NULL DEFAULT '',
  bhf_number text DEFAULT '',
  speciality text DEFAULT '',
  practitioner_role text NOT NULL DEFAULT 'gp',
  phone text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS practitioner_role text NOT NULL DEFAULT 'gp';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_practitioner_role_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_practitioner_role_check
      CHECK (practitioner_role IN (
        'gp',
        'neurologist',
        'specialist',
        'clinical_technologist',
        'pathologist'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'assistant')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited')),
  display_name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cases'
  ) THEN
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id);
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'draft';
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS doctor_approved boolean DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_cases_workspace_id ON cases(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_cases_delivery_status ON cases(delivery_status);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION accept_workspace_invite(invite_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv workspace_invites%ROWTYPE;
  member_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO inv
  FROM workspace_invites
  WHERE token = invite_token
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  IF lower((SELECT email FROM auth.users WHERE id = auth.uid())) <> lower(inv.email) THEN
    RAISE EXCEPTION 'Invite email does not match signed-in account';
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role, status, display_name)
  VALUES (
    inv.workspace_id,
    auth.uid(),
    'assistant',
    'active',
    COALESCE((SELECT first_name FROM profiles WHERE id = auth.uid()), '')
  )
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET status = 'active', role = 'assistant'
  RETURNING id INTO member_id;

  UPDATE workspace_invites
  SET status = 'accepted'
  WHERE id = inv.id;

  RETURN inv.workspace_id;
END;
$$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Workspace members read profiles" ON profiles;
CREATE POLICY "Workspace members read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM workspace_members wm1
      JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid()
        AND wm2.user_id = profiles.id
        AND wm1.status = 'active'
        AND wm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Members read workspace" ON workspaces;
CREATE POLICY "Members read workspace"
  ON workspaces FOR SELECT
  TO authenticated
  USING (is_workspace_member(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner creates workspace" ON workspaces;
CREATE POLICY "Owner creates workspace"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner updates workspace" ON workspaces;
CREATE POLICY "Owner updates workspace"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Members read membership" ON workspace_members;
CREATE POLICY "Members read membership"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Owner manages members" ON workspace_members;
CREATE POLICY "Owner manages members"
  ON workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner updates members" ON workspace_members;
CREATE POLICY "Owner updates members"
  ON workspace_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner manages invites" ON workspace_invites;
CREATE POLICY "Owner manages invites"
  ON workspace_invites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Invitee reads own pending invite" ON workspace_invites;
CREATE POLICY "Invitee reads own pending invite"
  ON workspace_invites FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    AND status = 'pending'
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cases'
  ) THEN
    DROP POLICY IF EXISTS "Workspace members read cases" ON cases;
    CREATE POLICY "Workspace members read cases"
      ON cases FOR SELECT TO authenticated
      USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

    DROP POLICY IF EXISTS "Workspace members insert cases" ON cases;
    CREATE POLICY "Workspace members insert cases"
      ON cases FOR INSERT TO authenticated
      WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));

    DROP POLICY IF EXISTS "Workspace members update cases" ON cases;
    CREATE POLICY "Workspace members update cases"
      ON cases FOR UPDATE TO authenticated
      USING (workspace_id IS NULL OR is_workspace_member(workspace_id))
      WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));

    DROP POLICY IF EXISTS "Workspace members delete cases" ON cases;
    CREATE POLICY "Workspace members delete cases"
      ON cases FOR DELETE TO authenticated
      USING (workspace_id IS NULL OR is_workspace_member(workspace_id));
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_invites TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_workspace_invite(text) TO authenticated;
