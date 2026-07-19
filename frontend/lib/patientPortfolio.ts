import type { ClaimType, PatientCase, SelectedMedication } from '@/types';
import { getCaseById } from '@/lib/caseService';

/** Stable portfolio key — one profile can have many claims; distinct from medical aid patient ID. */
export function createProfileId(): string {
  return `prof_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Must be a real UUID, not a prefixed string — this value is used as the
 * primary key of the `cases` row in Supabase (see saveCaseToDatabase upsert),
 * and case_referrals.case_id is a `uuid NOT NULL REFERENCES cases(id)` FK.
 * A non-UUID local ID here would make every referral insert fail silently.
 */
export function createCaseId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers/SSR edge cases)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function resolveProfileId(patientCase: PatientCase): string {
  return patientCase.profileId ?? `legacy_${patientCase.patientId.trim()}`;
}

const CASE_STATUS_RANK: Record<PatientCase['status'], number> = {
  new: 0,
  draft: 1,
  diagnostic: 2,
  ongoing: 3,
  completed: 4,
};

/** Merge Supabase row into local case without downgrading completed registrations. */
export function mergeWorkspaceCaseFromRemote(
  existing: PatientCase | undefined,
  remote: PatientCase
): PatientCase {
  if (!existing) return remote;

  const existingRank = CASE_STATUS_RANK[existing.status] ?? 0;
  const remoteRank = CASE_STATUS_RANK[remote.status] ?? 0;
  const keepLocalStatus = existingRank > remoteRank;

  const merged: PatientCase = {
    ...existing,
    ...remote,
    // Local portfolio identity + CIB state are not stored on the cases table —
    // never let a remote sync wipe them back to defaults.
    profileId: existing.profileId ?? remote.profileId,
    cibEnrollmentStatus:
      existing.cibEnrollmentStatus === 'registered'
        ? 'registered'
        : remote.cibEnrollmentStatus ?? existing.cibEnrollmentStatus,
    cibRecords:
      (existing.cibRecords?.length ?? 0) > 0 ? existing.cibRecords : remote.cibRecords,
    referrals: existing.referrals ?? remote.referrals,
    medicationReports: existing.medicationReports ?? remote.medicationReports,
    clinicalAppeals: existing.clinicalAppeals ?? remote.clinicalAppeals,
    specialistHandoffAcknowledged: existing.specialistHandoffAcknowledged,
    medications:
      (existing.medications?.length ?? 0) > 0 ? existing.medications : remote.medications,
  };

  if (keepLocalStatus) {
    merged.status = existing.status;
    merged.isWorkflowDraft = existing.isWorkflowDraft;
    merged.icdCode = existing.icdCode || remote.icdCode;
    merged.icdDescription = existing.icdDescription || remote.icdDescription;
    merged.condition = existing.condition || remote.condition;
    merged.deliveryStatus = existing.deliveryStatus ?? remote.deliveryStatus;
    merged.doctorApproved = existing.doctorApproved ?? remote.doctorApproved;
  }

  return merged;
}

export function casesForMedicalPatient(
  cases: PatientCase[],
  medicalPatientId: string
): PatientCase[] {
  const key = medicalPatientId.trim().toLowerCase();
  if (!key) return [];
  return cases.filter((c) => c.patientId.trim().toLowerCase() === key);
}

/** Prefer explicit prof_* ids so legacy and new intake claims share one portfolio. */
export function canonicalProfileId(cases: PatientCase[]): string {
  if (cases.length === 0) return '';
  const withProf = cases.find((c) => c.profileId?.startsWith('prof_'));
  if (withProf?.profileId) return withProf.profileId;
  return resolveProfileId(cases[0]);
}

export function filterCasesByProfile(cases: PatientCase[], profileId: string): PatientCase[] {
  const seed = cases.find((c) => resolveProfileId(c) === profileId);
  if (!seed?.patientId.trim()) {
    return cases.filter((c) => resolveProfileId(c) === profileId);
  }
  return casesForMedicalPatient(cases, seed.patientId);
}

/** Claims visible in portfolio, dashboard, and patient record — excludes in-progress drafts */
export function isPortfolioClaim(c: PatientCase): boolean {
  return !c.isWorkflowDraft;
}

/** In-progress claim that can be resumed instead of starting a duplicate draft */
export function isIncompleteClaim(c: PatientCase): boolean {
  if (c.status === 'completed') return false;
  if (c.isWorkflowDraft) return true;
  return c.status === 'draft' || c.status === 'new';
}

function incompleteClaimKey(c: PatientCase): string {
  const condition = (c.condition ?? '').trim().toLowerCase() || '__none__';
  return `${condition}::${c.claimType ?? 'diagnostic'}`;
}

/** Keep one resumable draft per condition + claim type; show all completed claims */
export function dedupePortfolioClaims(cases: PatientCase[]): PatientCase[] {
  const portfolio = cases.filter(isPortfolioClaim);
  const completed = portfolio.filter((c) => c.status === 'completed');
  const completedKeys = new Set(completed.map(incompleteClaimKey));

  const incomplete = portfolio.filter(
    (c) => isIncompleteClaim(c) && !completedKeys.has(incompleteClaimKey(c))
  );

  const latestIncomplete = new Map<string, PatientCase>();
  for (const claim of incomplete) {
    const key = incompleteClaimKey(claim);
    const existing = latestIncomplete.get(key);
    if (
      !existing ||
      new Date(claim.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
    ) {
      latestIncomplete.set(key, claim);
    }
  }

  return [...completed, ...latestIncomplete.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function findResumableClaim(
  cases: PatientCase[],
  profileId: string,
  opts?: { condition?: string; claimType?: ClaimType }
): PatientCase | undefined {
  const profileCases = filterCasesByProfile(cases, profileId);
  const completedKeys = new Set(
    profileCases.filter((c) => c.status === 'completed').map(incompleteClaimKey)
  );

  let candidates = profileCases.filter(isIncompleteClaim);
  candidates = candidates.filter((c) => !completedKeys.has(incompleteClaimKey(c)));

  if (opts?.condition) {
    const target = opts.condition.trim().toLowerCase();
    candidates = candidates.filter(
      (c) => (c.condition ?? '').trim().toLowerCase() === target
    );
  }
  if (opts?.claimType) {
    candidates = candidates.filter((c) => (c.claimType ?? 'diagnostic') === opts.claimType);
  }

  return candidates.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];
}

/** Case ids to drop — duplicate drafts or stale drafts after a completed claim exists */
export function pruneSupersededPortfolioDrafts(
  cases: PatientCase[],
  profileId: string
): string[] {
  const profileCases = filterCasesByProfile(cases, profileId).filter(isPortfolioClaim);
  const completedKeys = new Set(
    profileCases.filter((c) => c.status === 'completed').map(incompleteClaimKey)
  );
  const keepIds = new Set(
    dedupePortfolioClaims(profileCases)
      .filter(isIncompleteClaim)
      .map((c) => c.id)
  );

  return profileCases
    .filter((c) => {
      if (!isIncompleteClaim(c)) return false;
      if (completedKeys.has(incompleteClaimKey(c))) return true;
      return !keepIds.has(c.id);
    })
    .map((c) => c.id);
}

export function portfolioClaims(cases: PatientCase[]): PatientCase[] {
  return dedupePortfolioClaims(cases);
}

export function filterPortfolioClaimsByProfile(cases: PatientCase[], profileId: string): PatientCase[] {
  return dedupePortfolioClaims(filterCasesByProfile(cases, profileId));
}

/** Most recent medications across a patient's portfolio (for follow-up pre-fill). */
export function getLatestMedicationsFromPortfolio(cases: PatientCase[]): {
  medications: SelectedMedication[];
  medicationNote: string;
} {
  const sorted = [...cases].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  for (const c of sorted) {
    const meds = c.medications ?? [];
    if (meds.length > 0) {
      return { medications: meds, medicationNote: c.medicationNote ?? '' };
    }
  }
  const latest = sorted[0];
  return {
    medications: latest?.medications ?? [],
    medicationNote: latest?.medicationNote ?? '',
  };
}

/**
 * Pull medications from Supabase for portfolio cases that only have empty local
 * medication arrays — e.g. after specialist CIB completion before GP opens follow-up.
 */
export async function hydratePortfolioMedications(
  cases: PatientCase[],
  onCasePatched?: (caseId: string, medications: SelectedMedication[]) => void
): Promise<PatientCase[]> {
  const hydrated = cases.map((c) => ({ ...c }));

  await Promise.all(
    hydrated.map(async (patientCase, index) => {
      if ((patientCase.medications?.length ?? 0) > 0) return;
      const result = await getCaseById(patientCase.id);
      const remoteMeds = result.medications ?? [];
      if (!result.success || remoteMeds.length === 0) return;
      hydrated[index] = { ...patientCase, medications: remoteMeds };
      onCasePatched?.(patientCase.id, remoteMeds);
    })
  );

  return hydrated;
}

export function findCasesByMedicalId(cases: PatientCase[], medicalPatientId: string): PatientCase[] {
  return casesForMedicalPatient(cases, medicalPatientId);
}

export interface PatientProfileGroup {
  profileId: string;
  patientName: string;
  patientId: string;
  claims: PatientCase[];
  latestClaim: PatientCase;
}

export function groupCasesByProfile(cases: PatientCase[]): PatientProfileGroup[] {
  const byMedical = new Map<string, PatientCase[]>();

  for (const c of portfolioClaims(cases)) {
    const medicalKey = c.patientId.trim().toLowerCase();
    const key = medicalKey || `__nopid__${resolveProfileId(c)}`;
    if (!byMedical.has(key)) byMedical.set(key, []);
    byMedical.get(key)!.push(c);
  }

  const groups: PatientProfileGroup[] = [];
  byMedical.forEach((claims) => {
    const sorted = [...claims].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    groups.push({
      profileId: canonicalProfileId(sorted),
      patientName: sorted[0].patientName,
      patientId: sorted[0].patientId,
      claims: sorted,
      latestClaim: sorted[0],
    });
  });

  return groups.sort(
    (a, b) =>
      new Date(b.latestClaim.updatedAt).getTime() - new Date(a.latestClaim.updatedAt).getTime()
  );
}

export function validateNewPatientIntake(
  cases: PatientCase[],
  medicalPatientId: string,
  patientName: string
): { ok: true } | { ok: false; message: string } {
  const existing = findCasesByMedicalId(cases, medicalPatientId);
  if (existing.length === 0) return { ok: true };

  const existingName = existing[0].patientName.trim();
  const newName = patientName.trim();

  if (existingName.toLowerCase() === newName.toLowerCase()) {
    return {
      ok: false,
      message: `A patient with ID "${medicalPatientId.trim()}" is already on file as ${existingName}. Open their profile from the dashboard to add another claim.`,
    };
  }

  return {
    ok: false,
    message: `Patient ID "${medicalPatientId.trim()}" is already assigned to ${existingName}. Each new person needs a unique patient ID, or open the existing profile to add a claim.`,
  };
}

/** Resolve portfolio key when saving a claim for an existing medical patient. */
export function resolveProfileIdForSave(
  cases: PatientCase[],
  medicalPatientId: string,
  anchorCase?: PatientCase | null,
  preferredProfileId?: string | null
): string | undefined {
  if (preferredProfileId) return preferredProfileId;
  if (anchorCase?.profileId) return anchorCase.profileId;
  const siblings = findCasesByMedicalId(cases, medicalPatientId);
  return canonicalProfileId(siblings) || undefined;
}
