import { supabase } from './supabase';
import type {
  DoctorOnboardingInput,
  Profile,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
} from './workspaceTypes';

const mapProfile = (row: Record<string, unknown>): Profile => ({
  id: row.id as string,
  email: row.email as string,
  firstName: (row.first_name as string) || '',
  surname: (row.surname as string) || '',
  bhfNumber: (row.bhf_number as string) || '',
  speciality: (row.speciality as string) || '',
  phone: (row.phone as string) || '',
});

const mapWorkspace = (row: Record<string, unknown>): Workspace => ({
  id: row.id as string,
  name: row.name as string,
  ownerId: row.owner_id as string,
});

const mapMember = (row: Record<string, unknown>): WorkspaceMember => ({
  id: row.id as string,
  workspaceId: row.workspace_id as string,
  userId: row.user_id as string,
  role: row.role as WorkspaceMember['role'],
  status: row.status as WorkspaceMember['status'],
  displayName: (row.display_name as string) || '',
});

const mapInvite = (row: Record<string, unknown>): WorkspaceInvite => ({
  id: row.id as string,
  workspaceId: row.workspace_id as string,
  email: row.email as string,
  token: row.token as string,
  status: row.status as WorkspaceInvite['status'],
  expiresAt: row.expires_at as string,
  createdAt: row.created_at as string,
});

export async function signUpDoctor(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfile(data);
}

export async function fetchUserWorkspace(userId: string): Promise<{
  workspace: Workspace | null;
  membership: WorkspaceMember | null;
}> {
  const { data: membershipRow, error } = await supabase
    .from('workspace_members')
    .select('*, workspaces(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error || !membershipRow) {
    return { workspace: null, membership: null };
  }

  const workspaceData = membershipRow.workspaces as Record<string, unknown> | null;
  return {
    workspace: workspaceData ? mapWorkspace(workspaceData) : null,
    membership: mapMember(membershipRow),
  };
}

export async function completeDoctorOnboarding(
  userId: string,
  email: string,
  input: DoctorOnboardingInput
): Promise<{ workspace: Workspace; profile: Profile }> {
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    first_name: input.firstName.trim(),
    surname: input.surname.trim(),
    bhf_number: input.bhfNumber.trim(),
    speciality: input.speciality.trim(),
    phone: input.phone.trim(),
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name: input.practiceName.trim(),
      owner_id: userId,
    })
    .select()
    .single();

  if (workspaceError || !workspaceRow) {
    throw new Error(workspaceError?.message || 'Failed to create workspace');
  }

  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: workspaceRow.id,
    user_id: userId,
    role: 'owner',
    status: 'active',
    display_name: `${input.firstName.trim()} ${input.surname.trim()}`.trim(),
  });

  if (memberError) {
    throw new Error(memberError.message);
  }

  const profile = await fetchProfile(userId);
  if (!profile) {
    throw new Error('Profile was not created');
  }

  return {
    workspace: mapWorkspace(workspaceRow),
    profile,
  };
}

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  if (error || !data) return [];
  return data.map(mapMember);
}

export async function fetchWorkspaceInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  const { data, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(mapInvite);
}

export async function createWorkspaceInvite(
  workspaceId: string,
  email: string,
  invitedBy: string
): Promise<WorkspaceInvite> {
  const token =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: workspaceId,
      email: email.trim().toLowerCase(),
      token,
      invited_by: invitedBy,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create invite');
  }

  return mapInvite(data);
}

export async function fetchInviteByToken(token: string): Promise<WorkspaceInvite | null> {
  const { data, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return mapInvite(data);
}

export async function acceptWorkspaceInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_workspace_invite', {
    invite_token: token,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}

export async function signUpAssistant(email: string, password: string, firstName: string) {
  const result = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName },
    },
  });

  if (result.data.user && !result.error) {
    await supabase.from('profiles').upsert({
      id: result.data.user.id,
      email: email.trim().toLowerCase(),
      first_name: firstName.trim(),
    });
  }

  return result;
}

export function buildInviteUrl(token: string): string {
  if (typeof window === 'undefined') {
    return `/invite?token=${token}`;
  }
  return `${window.location.origin}/invite?token=${token}`;
}

export function getDoctorDisplayName(profile: Profile | null): string {
  if (!profile) return 'Doctor';
  const name = `${profile.firstName} ${profile.surname}`.trim();
  return name || profile.email;
}
