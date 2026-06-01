import { TreatmentItem } from '@/types';

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

export const isTestDocumented = (treatment: TreatmentItem): boolean => {
  const notes = treatment.documentation?.notes?.trim() ?? '';
  const images = treatment.documentation?.images?.length ?? 0;
  return notes.length > 0 || images > 0;
};

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

export const canProceedFromEvidenceReview = (
  treatments: TreatmentItem[],
  icdCode: string,
  diagnosisDate: string
): { ok: boolean; reason?: string } => {
  if (treatments.length === 0) {
    return { ok: false, reason: 'Select at least one diagnostic test before continuing.' };
  }
  const derived = deriveEvidenceFromDiagnostics(treatments);
  if (!derived.allTestsDocumented) {
    return {
      ok: false,
      reason: `Document findings for: ${derived.undocumentedTests.map((t) => t.description).join(', ')}`,
    };
  }
  if (!icdCode?.trim()) {
    return { ok: false, reason: 'Confirm ICD-10 code before continuing.' };
  }
  if (!diagnosisDate?.trim()) {
    return { ok: false, reason: 'Enter date of diagnosis before continuing.' };
  }
  if (!derived.hasLabResults) {
    return {
      ok: false,
      reason:
        'Attach findings or uploads for at least one diagnostic test (lab, EEG, or other non-imaging test).',
    };
  }
  if (derived.requiresImaging && !derived.hasImaging) {
    return { ok: false, reason: 'Attach imaging reports where imaging tests were ordered.' };
  }
  return { ok: true };
};
