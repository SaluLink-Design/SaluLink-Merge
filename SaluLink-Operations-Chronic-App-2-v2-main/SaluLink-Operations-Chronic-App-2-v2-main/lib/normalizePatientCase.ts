import { PatientCase, TreatmentItem, SelectedMedication } from '@/types';
import { normalizeSelectedMedication } from '@/lib/medicationCoverage';
import { resolveProfileId } from '@/lib/patientPortfolio';

const normalizeTreatment = (t: TreatmentItem): TreatmentItem => ({
  ...t,
  documentation: {
    notes: t.documentation?.notes ?? '',
    images: t.documentation?.images ?? [],
  },
});

/** Ensures legacy/partial persisted cases have required arrays and fields. */
export const normalizePatientCase = (raw: Partial<PatientCase> & { id: string }): PatientCase => {
  const createdAt = raw.createdAt ? new Date(raw.createdAt) : new Date();
  const updatedAt = raw.updatedAt ? new Date(raw.updatedAt) : createdAt;

  const patientId = raw.patientId ?? '';
  const withProfile: Partial<PatientCase> & { id: string } = {
    ...raw,
    profileId: raw.profileId ?? (patientId ? `legacy_${patientId.trim()}` : undefined),
  };

  return {
    id: withProfile.id,
    profileId: withProfile.profileId ?? resolveProfileId({ ...raw, patientId } as PatientCase),
    patientName: raw.patientName ?? '',
    patientId,
    patientEmail: raw.patientEmail,
    patientPhone: raw.patientPhone,
    medicalAidNumber: raw.medicalAidNumber,
    medicalScheme: raw.medicalScheme ?? 'discovery',
    cibEnrollmentStatus: raw.cibEnrollmentStatus ?? 'unregistered',
    claimType: raw.claimType,
    createdAt,
    updatedAt,
    clinicalNote: raw.clinicalNote ?? '',
    condition: raw.condition ?? '',
    icdCode: raw.icdCode ?? '',
    icdDescription: raw.icdDescription ?? '',
    diagnosticTreatments: (raw.diagnosticTreatments ?? []).map(normalizeTreatment),
    ongoingTreatments: (raw.ongoingTreatments ?? []).map(normalizeTreatment),
    medications: (raw.medications ?? []).map((m) => normalizeSelectedMedication(m)),
    medicationNote: raw.medicationNote ?? '',
    plan: raw.plan ?? 'Core',
    status: raw.status ?? 'draft',
    clinicalAppeals: raw.clinicalAppeals?.map((a) => ({
      ...a,
      createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
      images: a.images ?? [],
    })),
    medicationReports: raw.medicationReports?.map((r) => ({
      ...r,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      originalMedications: (r.originalMedications ?? []).map((m) =>
        normalizeSelectedMedication(m)
      ),
      newMedications: (r.newMedications ?? []).map((m) => normalizeSelectedMedication(m)),
    })),
    referrals: raw.referrals?.map((ref) => ({
      ...ref,
      createdAt: ref.createdAt ? new Date(ref.createdAt) : new Date(),
    })),
    cibRecords: raw.cibRecords ?? [],
  };
};

export const normalizePatientCases = (cases: Array<Partial<PatientCase> & { id: string }>): PatientCase[] =>
  cases.map(normalizePatientCase);
