export type WorkspaceRole = 'owner' | 'assistant';

export type DeliveryStatus = 'draft' | 'ready_to_send' | 'sent_to_patient';

import type { PractitionerRole } from '@/types';

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  surname: string;
  bhfNumber: string;
  speciality: string;
  practitionerRole: PractitionerRole;
  phone: string;
  /** Opt-in: visible to other workspaces via search_specialist_directory(). */
  directoryListed: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: 'active' | 'invited';
  displayName: string;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface DoctorOnboardingInput {
  firstName: string;
  surname: string;
  bhfNumber: string;
  speciality: string;
  practitionerRole: PractitionerRole;
  phone: string;
  practiceName: string;
  directoryListed: boolean;
}

export interface WorkspaceContextValue {
  profile: Profile | null;
  workspace: Workspace | null;
  membership: WorkspaceMember | null;
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  isLoading: boolean;
  isOwner: boolean;
  isAssistant: boolean;
  refreshWorkspace: () => Promise<void>;
}
