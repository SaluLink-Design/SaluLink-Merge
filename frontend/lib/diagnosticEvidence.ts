import { TreatmentItem, BenefitState } from '@/types';
import { computeEvidenceCompleteness } from '@/lib/benefitState';

/** Minimum CIB evidence pack score before leaving final evidence review */
export const EVIDENCE_REVIEW_MIN_SCORE = 80;

export type DiagnosticEvidenceType = 'lab' | 'imaging' | 'other';

/** Labs, pathology, and non-imaging procedures (e.g. EEG) — not radiology */
const LAB_KEYWORDS = [
  'glucose', 'cholesterol', 'creatinine', 'urine', 'u & e', 'electrolyte',
  'pathology', 'lab', 'blood', 'hba1c', 'lipid', 'ecg', 'electrocardiogram',
  'spirometry', 'peak flow', 'flow volume', 'ambulatory blood pressure',
  'dipstick', 'fasting', 'random', 'microalbumin', 'ogtt', 'triglyceride',
  'thyrotropin', 'tsh', 'thyroxine', 'ft4', 'parathyroid', 'calcium', 'iron',
  'ferritin', 'transferrin', 'platelet', 'protein', 'fibrinogen', 'troponin',
  'natriuretic', 'bnp', 'c-reactive', 'antitrypsin', 'factor viii', 'factor ix',
  'coagulation', 'bleeding', 'thrombin', 'thromboplastin', 'prothrombin',
  'potassium', 'aspartate', 'alanine', 'drug level', 'biological fluid',
  'therapeutic drug', 'threshold testing', 'programming',
  'eeg', 'encephalogram', 'electro-encephalogram', 'tonometry', 'fundus',
];

const IMAGING_KEYWORDS = [
  'x-ray', 'xray', 'mri', 'ct scan', 'ct ', 'ultrasound', 'sonar', 'radiograph',
  'imaging', 'scan', 'mammogram', 'echocardiogram', 'echo ',
];

export const classifyDiagnosticTest = (description: string): DiagnosticEvidenceType => {
  const lower = description.toLowerCase();
  if (IMAGING_KEYWORDS.some((kw) => lower.includes(kw))) return 'imaging';
  if (LAB_KEYWORDS.some((kw) => lower.includes(kw))) return 'lab';
  return 'other';
};

/** True when attachment payload is a non-empty saved file (base64 JSON or legacy string). */
export const hasValidAttachments = (images: string[] | undefined): boolean => {
  if (!images?.length) return false;
  return images.some((img) => {
    const raw = img?.trim();
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as { data?: string; name?: string };
      return Boolean(parsed.data?.length || parsed.name?.length);
    } catch {
      return raw.length > 20;
    }
  });
};

export const countValidAttachments = (images: string[] | undefined): number => {
  if (!images?.length) return 0;
  return images.filter((img) => {
    const raw = img?.trim();
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as { data?: string; name?: string };
      return Boolean(parsed.data?.length || parsed.name?.length);
    } catch {
      return raw.length > 20;
    }
  }).length;
};

export interface TreatmentDocumentationStatus {
  documented: boolean;
  hasNotes: boolean;
  hasFiles: boolean;
  fileCount: number;
  /** Short label for checklists, e.g. "2 files attached" */
  detailLabel: string;
}

export const getTreatmentDocumentationStatus = (
  treatment: TreatmentItem
): TreatmentDocumentationStatus => {
  const hasNotes = Boolean(treatment.documentation?.notes?.trim());
  const fileCount = countValidAttachments(treatment.documentation?.images);
  const hasFiles = fileCount > 0;
  const documented = hasNotes || hasFiles;

  let detailLabel = 'needs findings or uploads';
  if (hasNotes && hasFiles) {
    detailLabel = `findings + ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
  } else if (hasNotes) {
    detailLabel = 'written findings';
  } else if (hasFiles) {
    detailLabel = `${fileCount} file${fileCount !== 1 ? 's' : ''} attached`;
  }

  return { documented, hasNotes, hasFiles, fileCount, detailLabel };
};

export const isTestDocumented = (treatment: TreatmentItem): boolean =>
  getTreatmentDocumentationStatus(treatment).documented;

export const deriveEvidenceFromDiagnostics = (treatments: TreatmentItem[]) => {
  const labTests = treatments.filter((t) => classifyDiagnosticTest(t.description) === 'lab');
  const imagingTests = treatments.filter((t) => classifyDiagnosticTest(t.description) === 'imaging');

  const labDocumented = labTests.filter(isTestDocumented);
  const imagingDocumented = imagingTests.filter(isTestDocumented);

  // Non-imaging diagnostics (labs, EEG, procedures) — at least one must have findings
  const nonImagingTests = treatments.filter(
    (t) => classifyDiagnosticTest(t.description) !== 'imaging'
  );
  const nonImagingDocumented = nonImagingTests.filter(isTestDocumented);
  const hasLabResults =
    nonImagingTests.length === 0 ? false : nonImagingDocumented.length > 0;

  const hasImaging =
    imagingTests.length === 0 ? true : imagingDocumented.length > 0;

  const allTestsDocumented =
    treatments.length > 0 && treatments.every(isTestDocumented);

  const undocumentedTests = treatments.filter((t) => !isTestDocumented(t));

  return {
    labTests,
    imagingTests,
    labDocumented,
    imagingDocumented,
    hasLabResults,
    hasImaging,
    allTestsDocumented,
    undocumentedTests,
    requiresImaging: imagingTests.length > 0,
  };
};

export interface EvidenceReviewGateInput {
  treatments: TreatmentItem[];
  conditionName: string;
  icdCode: string;
  clinicalNote: string;
  diagnosisDate: string;
  benefitState?: BenefitState;
  medicationsFormularyAligned?: boolean;
}

export const canProceedFromEvidenceReview = (
  input: EvidenceReviewGateInput
): { ok: boolean; reason?: string; score?: number } => {
  const {
    treatments,
    conditionName,
    icdCode,
    clinicalNote,
    diagnosisDate,
    benefitState = 'unregistered',
    medicationsFormularyAligned = true,
  } = input;

  if (treatments.length === 0) {
    return { ok: false, reason: 'Select at least one diagnostic test before continuing.' };
  }

  const derived = deriveEvidenceFromDiagnostics(treatments);
  if (!derived.allTestsDocumented) {
    return {
      ok: false,
      reason: `Add written findings or upload supporting documents for: ${derived.undocumentedTests.map((t) => t.description).join(', ')}`,
    };
  }

  if (!diagnosisDate?.trim()) {
    return { ok: false, reason: 'Enter date of diagnosis before continuing.' };
  }

  const evidence = computeEvidenceCompleteness({
    conditionName,
    icdCode,
    clinicalNote,
    benefitState,
    diagnosisDate,
    diagnosticTreatments: treatments,
    medicationsFormularyAligned,
  });

  if (evidence.score < EVIDENCE_REVIEW_MIN_SCORE) {
    const missing =
      evidence.missingItems.length > 0
        ? ` Still needed: ${evidence.missingItems.join('; ')}.`
        : '';
    return {
      ok: false,
      score: evidence.score,
      reason: `Evidence pack is ${evidence.score}% complete (minimum ${EVIDENCE_REVIEW_MIN_SCORE}%).${missing}`,
    };
  }

  return { ok: true, score: evidence.score };
};
