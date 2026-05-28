import {
  ClaimType,
  PatientCase,
  ReferralData,
  SelectedMedication,
  TreatmentItem,
} from '@/types';
import {
  classifyDiagnosticTest,
  isTestDocumented,
  type DiagnosticEvidenceType,
} from '@/lib/diagnosticEvidence';
import { getPatientCibRecords, getPatientEnrollmentStatus } from '@/lib/benefitState';
import { filterCasesByProfile } from '@/lib/patientPortfolio';

export type TestSource = 'diagnostic' | 'ongoing';

export interface PatientRecordDemographics {
  patientName: string;
  patientId: string;
  plan: string;
  medicalScheme: string;
  medicalAidNumber: string;
  patientEmail: string;
  patientPhone: string;
  cibEnrollmentStatus: string;
}

export interface PatientRecordCondition {
  name: string;
  icdCode: string;
  icdDescription: string;
  lastUpdated: Date;
  fromCib: boolean;
}

export interface PatientRecordTestRow {
  id: string;
  description: string;
  code: string;
  caseId: string;
  claimDate: Date;
  claimType?: ClaimType;
  condition?: string;
  source: TestSource;
  evidenceType: DiagnosticEvidenceType;
  documented: boolean;
  notesPreview: string;
  attachmentCount: number;
  timesCompleted?: number;
  maxCovered?: number;
}

export interface PatientRecordMedicationRow {
  name: string;
  activeIngredient: string;
  lastPrescribed: Date;
  caseId: string;
  formularyStatus?: string;
}

export interface PatientRecordVisitRow {
  caseId: string;
  date: Date;
  claimType?: ClaimType;
  status: string;
  condition: string;
  clinicalNoteExcerpt: string;
}

export interface PatientRecordReferralRow extends ReferralData {
  caseId: string;
  patientName: string;
}

export interface PatientRecord {
  demographics: PatientRecordDemographics;
  conditions: PatientRecordCondition[];
  labResults: PatientRecordTestRow[];
  imaging: PatientRecordTestRow[];
  diagnosticTesting: PatientRecordTestRow[];
  ongoingMonitoring: PatientRecordTestRow[];
  medications: PatientRecordMedicationRow[];
  visits: PatientRecordVisitRow[];
  referrals: PatientRecordReferralRow[];
  totalClaims: number;
}

function attachmentCount(treatment: TreatmentItem): number {
  return treatment.documentation?.images?.length ?? 0;
}

function notesPreview(treatment: TreatmentItem): string {
  const notes = treatment.documentation?.notes?.trim() ?? '';
  if (!notes) return '';
  return notes.length > 120 ? `${notes.slice(0, 117)}…` : notes;
}

function treatmentToRow(
  treatment: TreatmentItem,
  patientCase: PatientCase,
  source: TestSource,
  index: number
): PatientRecordTestRow {
  const evidenceType = classifyDiagnosticTest(treatment.description);
  return {
    id: `${patientCase.id}-${source}-${index}`,
    description: treatment.description,
    code: treatment.code,
    caseId: patientCase.id,
    claimDate: new Date(patientCase.updatedAt),
    claimType: patientCase.claimType,
    condition: patientCase.condition || undefined,
    source,
    evidenceType,
    documented: isTestDocumented(treatment),
    notesPreview: notesPreview(treatment),
    attachmentCount: attachmentCount(treatment),
    timesCompleted: treatment.timesCompleted,
    maxCovered: treatment.maxCovered,
  };
}

function collectTestsFromCases(patientCases: PatientCase[]): PatientRecordTestRow[] {
  const rows: PatientRecordTestRow[] = [];
  for (const c of patientCases) {
    (c.diagnosticTreatments ?? []).forEach((t, i) => {
      rows.push(treatmentToRow(t, c, 'diagnostic', i));
    });
    (c.ongoingTreatments ?? []).forEach((t, i) => {
      rows.push(treatmentToRow(t, c, 'ongoing', i));
    });
  }
  return rows.sort((a, b) => b.claimDate.getTime() - a.claimDate.getTime());
}

function collectMedications(patientCases: PatientCase[]): PatientRecordMedicationRow[] {
  const medMap = new Map<string, PatientRecordMedicationRow>();
  for (const c of patientCases) {
    const addMed = (med: SelectedMedication) => {
      const key = med.medicineNameAndStrength?.trim().toLowerCase();
      if (!key) return;
      const updated = new Date(c.updatedAt);
      const existing = medMap.get(key);
      if (!existing || updated > existing.lastPrescribed) {
        medMap.set(key, {
          name: med.medicineNameAndStrength,
          activeIngredient: med.activeIngredient || '',
          lastPrescribed: updated,
          caseId: c.id,
          formularyStatus: med.formularyStatus,
        });
      }
    };
    (c.medications ?? []).forEach(addMed);
    (c.medicationReports ?? []).forEach((report) => {
      report.newMedications?.forEach(addMed);
      report.originalMedications?.forEach(addMed);
    });
  }
  return Array.from(medMap.values()).sort(
    (a, b) => b.lastPrescribed.getTime() - a.lastPrescribed.getTime()
  );
}

const claimTypeLabels: Record<ClaimType, string> = {
  diagnostic: 'Diagnostic',
  'ongoing-management': 'Ongoing Mgmt',
  'medication-report': 'Medication Report',
  referral: 'Referral',
};

export function claimTypeLabel(claimType?: ClaimType): string {
  if (!claimType) return 'Intake';
  return claimTypeLabels[claimType];
}

export function buildPatientRecord(
  allCases: PatientCase[],
  profileId: string
): PatientRecord | null {
  const patientCases = filterCasesByProfile(allCases, profileId).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (patientCases.length === 0) return null;

  const latest = patientCases[0];
  const allTests = collectTestsFromCases(patientCases);

  const labResults = allTests.filter((t) => t.evidenceType === 'lab');
  const imaging = allTests.filter((t) => t.evidenceType === 'imaging');
  const diagnosticTesting = allTests.filter(
    (t) => t.source === 'diagnostic' && t.evidenceType === 'other'
  );
  const ongoingMonitoring = allTests.filter((t) => t.source === 'ongoing');

  const conditionMap = new Map<string, PatientRecordCondition>();
  for (const c of patientCases) {
    if (!c.condition?.trim()) continue;
    const key = c.condition.trim().toLowerCase();
    const updated = new Date(c.updatedAt);
    const existing = conditionMap.get(key);
    if (!existing || updated > existing.lastUpdated) {
      conditionMap.set(key, {
        name: c.condition.trim(),
        icdCode: c.icdCode || '',
        icdDescription: c.icdDescription || '',
        lastUpdated: updated,
        fromCib: false,
      });
    }
  }

  const medicalPatientId = latest.patientId;
  const cibRecords = getPatientCibRecords(allCases, medicalPatientId);
  for (const rec of cibRecords) {
    const key = rec.conditionName.trim().toLowerCase();
    const existing = conditionMap.get(key);
    if (!existing) {
      conditionMap.set(key, {
        name: rec.conditionName,
        icdCode: rec.icd10 || '',
        icdDescription: '',
        lastUpdated: new Date(),
        fromCib: true,
      });
    } else {
      existing.fromCib = true;
      if (rec.icd10) existing.icdCode = rec.icd10;
    }
  }

  const visits: PatientRecordVisitRow[] = patientCases.map((c) => {
    const note = c.clinicalNote?.trim() ?? '';
    return {
      caseId: c.id,
      date: new Date(c.updatedAt),
      claimType: c.claimType,
      status: c.status,
      condition: c.condition || 'No condition recorded',
      clinicalNoteExcerpt:
        note.length > 200 ? `${note.slice(0, 197)}…` : note || '—',
    };
  });

  const referrals: PatientRecordReferralRow[] = [];
  for (const c of patientCases) {
    (c.referrals ?? []).forEach((ref) => {
      referrals.push({ ...ref, caseId: c.id, patientName: c.patientName });
    });
  }

  return {
    demographics: {
      patientName: latest.patientName,
      patientId: medicalPatientId,
      plan: latest.plan || 'Core',
      medicalScheme: latest.medicalScheme === 'gems' ? 'GEMS' : 'Discovery Health',
      medicalAidNumber: latest.medicalAidNumber || '—',
      patientEmail: latest.patientEmail || '—',
      patientPhone: latest.patientPhone || '—',
      cibEnrollmentStatus:
        getPatientEnrollmentStatus(allCases, medicalPatientId) === 'registered'
          ? 'Registered on CIB'
          : 'Not registered on CIB',
    },
    conditions: Array.from(conditionMap.values()).sort(
      (a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()
    ),
    labResults,
    imaging,
    diagnosticTesting,
    ongoingMonitoring,
    medications: collectMedications(patientCases),
    visits,
    referrals,
    totalClaims: patientCases.length,
  };
}

export type PatientRecordSectionId =
  | 'conditions'
  | 'labs'
  | 'imaging'
  | 'diagnostic'
  | 'ongoing'
  | 'medications'
  | 'visits'
  | 'referrals';

export function sectionRecordCount(record: PatientRecord, section: PatientRecordSectionId): number {
  switch (section) {
    case 'conditions':
      return record.conditions.length;
    case 'labs':
      return record.labResults.length;
    case 'imaging':
      return record.imaging.length;
    case 'diagnostic':
      return record.diagnosticTesting.length;
    case 'ongoing':
      return record.ongoingMonitoring.length;
    case 'medications':
      return record.medications.length;
    case 'visits':
      return record.visits.length;
    case 'referrals':
      return record.referrals.length;
    default:
      return 0;
  }
}
