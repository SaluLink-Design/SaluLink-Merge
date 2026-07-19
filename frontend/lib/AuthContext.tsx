'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearPersistedCaseStore } from '@/lib/store';
import {
  acceptWorkspaceInvite,
  completeDoctorOnboarding,
  fetchInviteByToken,
  fetchProfile,
  fetchUserWorkspace,
  fetchWorkspaceInvites,
  fetchWorkspaceMembers,
  deleteMyAccount,
  signIn,
  signOut,
  signUpAssistant,
  signUpDoctor,
  updateDirectoryListing,
} from '@/lib/workspaceService';
import type {
  DoctorOnboardingInput,
  Profile,
  Workspace,
  WorkspaceContextValue,
  WorkspaceInvite,
  WorkspaceMember,
} from '@/lib/workspaceTypes';

interface AuthContextValue extends WorkspaceContextValue {
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  signUpDoctorAccount: (email: string, password: string) => Promise<{ error: string | null }>;
  signInAccount: (email: string, password: string) => Promise<{ error: string | null }>;
  signOutAccount: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
  completeOnboarding: (input: DoctorOnboardingInput) => Promise<{ error: string | null }>;
  setDirectoryListing: (listed: boolean) => Promise<{ error: string | null }>;
  signUpAssistantAccount: (
    email: string,
    password: string,
    firstName: string,
    inviteToken: string
  ) => Promise<{ error: string | null }>;
  acceptInvite: (token: string) => Promise<{ error: string | null }>;
  pendingInvite: WorkspaceInvite | null;
  loadPendingInvite: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [pendingInvite, setPendingInvite] = useState<WorkspaceInvite | null>(null);

  const refreshWorkspace = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setWorkspace(null);
      setMembership(null);
      setMembers([]);
      setInvites([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const userProfile = await fetchProfile(user.id);
      const { workspace: ws, membership: mem } = await fetchUserWorkspace(user.id);
      setProfile(userProfile);
      setWorkspace(ws);
      setMembership(mem);

      if (ws) {
        const [memberRows, inviteRows] = await Promise.all([
          fetchWorkspaceMembers(ws.id),
          mem?.role === 'owner' ? fetchWorkspaceInvites(ws.id) : Promise.resolve([]),
        ]);
        setMembers(memberRows);
        setInvites(inviteRows);
      } else {
        setMembers([]);
        setInvites([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  const signUpDoctorAccount = useCallback(async (email: string, password: string) => {
    const { error } = await signUpDoctor(email, password);
    return { error: error?.message ?? null };
  }, []);

  const signInAccount = useCallback(async (email: string, password: string) => {
    const { error } = await signIn(email, password);
    return { error: error?.message ?? null };
  }, []);

  const signOutAccount = useCallback(async () => {
    await signOut();
    clearPersistedCaseStore();
    setProfile(null);
    setWorkspace(null);
    setMembership(null);
    setMembers([]);
    setInvites([]);
  }, []);

  const deleteAccount = useCallback(async () => {
    const { error } = await deleteMyAccount();
    if (error) {
      return { error: error.message };
    }

    // Ensure local auth/session state is flushed even when auth row vanishes
    // server-side as part of delete_my_account().
    await signOut();
    clearPersistedCaseStore();
    setProfile(null);
    setWorkspace(null);
    setMembership(null);
    setMembers([]);
    setInvites([]);
    return { error: null };
  }, []);

  const completeOnboarding = useCallback(
    async (input: DoctorOnboardingInput) => {
      if (!user?.email) {
        return { error: 'You must be signed in to complete onboarding.' };
      }
      try {
        const result = await completeDoctorOnboarding(user.id, user.email, input);
        setProfile(result.profile);
        setWorkspace(result.workspace);
        setMembership({
          id: '',
          workspaceId: result.workspace.id,
          userId: user.id,
          role: 'owner',
          status: 'active',
          displayName: `${input.firstName} ${input.surname}`.trim(),
        });
        await refreshWorkspace();
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Onboarding failed' };
      }
    },
    [refreshWorkspace, user]
  );

  const setDirectoryListing = useCallback(
    async (listed: boolean) => {
      if (!user) return { error: 'You must be signed in to change directory settings.' };
      try {
        const nextProfile = await updateDirectoryListing(user.id, listed);
        setProfile(nextProfile);
        return { error: null };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : 'Could not save directory settings.',
        };
      }
    },
    [user]
  );

  const loadPendingInvite = useCallback(async (token: string) => {
    const invite = await fetchInviteByToken(token);
    setPendingInvite(invite);
  }, []);

  const acceptInvite = useCallback(
    async (token: string) => {
      try {
        await acceptWorkspaceInvite(token);
        await refreshWorkspace();
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to accept invite' };
      }
    },
    [refreshWorkspace]
  );

  const signUpAssistantAccount = useCallback(
    async (email: string, password: string, firstName: string, inviteToken: string) => {
      const { error: signUpError } = await signUpAssistant(email, password, firstName);
      if (signUpError) {
        return { error: signUpError.message };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        return {
          error:
            'Account created. Please confirm your email, then sign in to accept the invite.',
        };
      }

      return acceptInvite(inviteToken);
    },
    [acceptInvite]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      authLoading,
      profile,
      workspace,
      membership,
      members,
      invites,
      isLoading,
      isOwner: membership?.role === 'owner',
      isAssistant: membership?.role === 'assistant',
      refreshWorkspace,
      signUpDoctorAccount,
      signInAccount,
      signOutAccount,
      deleteAccount,
      completeOnboarding,
      setDirectoryListing,
      signUpAssistantAccount,
      acceptInvite,
      pendingInvite,
      loadPendingInvite,
    }),
    [
      session,
      user,
      authLoading,
      profile,
      workspace,
      membership,
      members,
      invites,
      isLoading,
      refreshWorkspace,
      signUpDoctorAccount,
      signInAccount,
      signOutAccount,
      deleteAccount,
      completeOnboarding,
      setDirectoryListing,
      signUpAssistantAccount,
      acceptInvite,
      pendingInvite,
      loadPendingInvite,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
