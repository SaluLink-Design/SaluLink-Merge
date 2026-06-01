import type { PatientCase } from '@/types';

/** Stable portfolio key — one profile can have many claims; distinct from medical aid patient ID. */
export function createProfileId(): string {
  return `prof_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createCaseId(): string {
  return `case_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function resolveProfileId(patientCase: PatientCase): string {
  return patientCase.profileId ?? `legacy_${patientCase.patientId.trim()}`;
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

  for (const c of cases) {
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
