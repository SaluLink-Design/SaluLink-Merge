import { supabase } from '@/lib/supabase';
import type { PractitionerRole } from '@/types';

export const SPECIALIST_DIRECTORY_ROLES: PractitionerRole[] = [
  'neurologist',
  'specialist',
  'clinical_technologist',
  'pathologist',
];

export function canListInSpecialistDirectory(role: PractitionerRole): boolean {
  return SPECIALIST_DIRECTORY_ROLES.includes(role);
}

export interface SpecialistDirectoryEntry {
  profileId: string;
  displayName: string;
  practitionerRole: string;
  speciality: string;
  workspaceId: string;
  workspaceName: string;
}

/**
 * Narrow, opt-in specialist lookup (search_specialist_directory RPC —
 * see migration 20260715120000_specialist_directory.sql). Returns only
 * name/role/speciality/workspace — never contact details — and only for
 * profiles that opted in via `directory_listed`.
 */
export async function searchSpecialistDirectory(
  query: string
): Promise<SpecialistDirectoryEntry[]> {
  const { data, error } = await supabase.rpc('search_specialist_directory', {
    p_query: query.trim(),
  });

  if (error) {
    console.error('Specialist directory search failed:', error.message);
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    profileId: row.profile_id as string,
    displayName: (row.display_name as string) || 'Unnamed specialist',
    practitionerRole: (row.practitioner_role as string) || '',
    speciality: (row.speciality as string) || '',
    workspaceId: row.workspace_id as string,
    workspaceName: (row.workspace_name as string) || 'Unnamed practice',
  }));
}
