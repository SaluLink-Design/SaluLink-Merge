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

export function filterCasesByProfile(cases: PatientCase[], profileId: string): PatientCase[] {
  return cases.filter((c) => resolveProfileId(c) === profileId);
}

export function findCasesByMedicalId(cases: PatientCase[], medicalPatientId: string): PatientCase[] {
  const key = medicalPatientId.trim().toLowerCase();
  return cases.filter((c) => c.patientId.trim().toLowerCase() === key);
}

export interface PatientProfileGroup {
  profileId: string;
  patientName: string;
  patientId: string;
  claims: PatientCase[];
  latestClaim: PatientCase;
}

export function groupCasesByProfile(cases: PatientCase[]): PatientProfileGroup[] {
  const grouped = new Map<string, PatientCase[]>();

  for (const c of cases) {
    const key = resolveProfileId(c);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  const groups: PatientProfileGroup[] = [];
  grouped.forEach((claims, profileId) => {
    const sorted = [...claims].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    groups.push({
      profileId,
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
