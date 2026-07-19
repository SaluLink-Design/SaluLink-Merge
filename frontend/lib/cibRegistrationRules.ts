import type {
  CareActionOwner,
  CibApprovalPath,
  CibConditionRules,
  CibRequirement,
  CibRequirementType,
  PractitionerRole,
} from '@/types';
import { normalizeConditionName } from '@/lib/conditionNames';

export interface ActionTemplate {
  requirementKey: string;
  requirementLabel: string;
  requirementType: CibRequirementType;
  actionTitle: string;
  purpose: string;
  likelyProviders: string[];
  defaultOwner: CareActionOwner;
  code?: string;
  specialty?: string;
  autoResolvable: boolean;
  gpPathway?: 'referral' | 'order' | 'perform';
  referralSpecialty?: string;
  performer?: string;
  interpreter?: string;
}

let rulesCache: CibConditionRules[] | null = null;

export function invalidateCibRegistrationRulesCache(): void {
  rulesCache = null;
}

export async function loadCibRegistrationRules(): Promise<CibConditionRules[]> {
  if (rulesCache) return rulesCache;
  const res = await fetch(`/cib-registration-rules.json?v=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to load CIB registration rules');
  const data = await res.json();
  rulesCache = data.conditions as CibConditionRules[];
  return rulesCache;
}

export function getConditionRules(
  rules: CibConditionRules[],
  condition: string
): CibConditionRules | undefined {
  const key = normalizeConditionName(condition).toLowerCase();
  return rules.find((r) => normalizeConditionName(r.condition).toLowerCase() === key);
}

export function requirementKey(req: CibRequirement): string {
  const parts = [req.type, req.code ?? '', req.specialty ?? ''].filter(Boolean);
  return parts.join(':');
}

const OWNER_BY_TYPE: Partial<Record<CibRequirementType, CareActionOwner>> = {
  gp_application: 'gp',
  specialist_application: 'specialist',
  investigation: 'external',
  lab_result: 'external',
  supporting_diagnosis: 'gp',
  clinical_notes: 'gp',
  icd_confirmed: 'gp',
  diagnosis_date: 'gp',
};

const AUTO_RESOLVABLE: CibRequirementType[] = [
  'icd_confirmed',
  'diagnosis_date',
  'clinical_notes',
];

export function compileActionTemplate(req: CibRequirement): ActionTemplate {
  const key = requirementKey(req);
  const owner = OWNER_BY_TYPE[req.type] ?? 'gp';

  switch (req.type) {
    case 'investigation': {
      const isEeg = req.code === '2711' || req.label.toLowerCase().includes('eeg');
      const gpReferral = req.gpPathway === 'referral' || (isEeg && !req.gpPathway);
      return {
        requirementKey: key,
        requirementLabel: req.label,
        requirementType: req.type,
        actionTitle: gpReferral
          ? `Refer for ${isEeg ? 'EEG' : req.label.replace(/ record$/i, '')}`
          : isEeg
            ? 'Order EEG Investigation'
            : `Order ${req.label.replace(/ record$/i, '')}`,
        purpose: isEeg
          ? gpReferral
            ? 'EEG is not performed in general practice. Refer to neurology or a neurodiagnostic unit for CIB evidence.'
            : 'Required for epilepsy CIB registration and diagnosis confirmation.'
          : 'Required for CIB registration and diagnosis confirmation.',
        likelyProviders: isEeg
          ? ['Neurology / Neurodiagnostic Unit', 'Clinical Technologist']
          : ['Clinical Technologist', 'Neurodiagnostic Unit', 'Neurologist'],
        defaultOwner: owner,
        code: req.code,
        autoResolvable: false,
        gpPathway: gpReferral ? 'referral' : req.gpPathway,
        referralSpecialty: req.referralSpecialty ?? (isEeg ? 'neurology' : undefined),
        performer: req.performer ?? (isEeg ? 'clinical_technologist' : undefined),
        interpreter: req.interpreter ?? (isEeg ? 'neurologist' : undefined),
      };
    }
    case 'lab_result':
      return {
        requirementKey: key,
        requirementLabel: req.label,
        requirementType: req.type,
        actionTitle: `Order ${req.code ?? req.label} Laboratory Test`,
        purpose: 'Required laboratory evidence for CIB registration.',
        likelyProviders: ['Pathology Laboratory', 'GP'],
        defaultOwner: owner,
        code: req.code,
        autoResolvable: false,
      };
    case 'gp_application':
      return {
        requirementKey: key,
        requirementLabel: req.label,
        requirementType: req.type,
        actionTitle: 'Complete GP CIB Application',
        purpose: 'Submit chronic illness benefit application for this condition.',
        likelyProviders: ['GP'],
        defaultOwner: owner,
        autoResolvable: false,
      };
    case 'specialist_application':
      return {
        requirementKey: key,
        requirementLabel: req.label,
        requirementType: req.type,
        actionTitle: `Submit ${req.specialty ? capitalize(req.specialty) : 'Specialist'} CIB Application`,
        purpose: 'Specialist-led CIB registration pathway.',
        likelyProviders: [req.specialty ? `${capitalize(req.specialty)} Specialist` : 'Specialist'],
        defaultOwner: owner,
        specialty: req.specialty,
        autoResolvable: false,
      };
    case 'supporting_diagnosis':
      return {
        requirementKey: key,
        requirementLabel: req.label,
        requirementType: req.type,
        actionTitle: 'Attach Supporting Diagnosis Documentation',
        purpose: 'Documentary evidence confirming the chronic diagnosis.',
        likelyProviders: ['GP', 'Specialist'],
        defaultOwner: owner,
        autoResolvable: false,
      };
    case 'clinical_notes':
      return {
        requirementKey: key,
        requirementLabel: req.label,
        requirementType: req.type,
        actionTitle: 'Document Clinical Notes',
        purpose: 'Clinical notes supporting the chronic condition diagnosis.',
        likelyProviders: ['GP'],
        defaultOwner: owner,
        autoResolvable: true,
      };
    case 'icd_confirmed':
      return {
        requirementKey: key,
        requirementLabel: req.label,
        requirementType: req.type,
        actionTitle: 'Confirm ICD-10 Code',
        purpose: 'ICD-10 code must be confirmed for CIB registration.',
        likelyProviders: ['GP'],
        defaultOwner: owner,
        autoResolvable: true,
      };
    case 'diagnosis_date':
      return {
        requirementKey: key,
        requirementLabel: req.label,
        requirementType: req.type,
        actionTitle: 'Record Diagnosis Date',
        purpose: 'Date of diagnosis required for CIB registration.',
        likelyProviders: ['GP'],
        defaultOwner: owner,
        autoResolvable: true,
      };
    default:
      return {
        requirementKey: key,
        requirementLabel: req.label,
        requirementType: req.type,
        actionTitle: req.label,
        purpose: 'Required for CIB registration.',
        likelyProviders: ['GP'],
        defaultOwner: owner,
        autoResolvable: false,
      };
  }
}

export function getRequirementsForPath(
  conditionRules: CibConditionRules,
  approvalPathId: string
): CibRequirement[] {
  const path = conditionRules.approvalPaths.find((p) => p.id === approvalPathId);
  if (!path) return conditionRules.commonRequirements;
  return [...path.requirements, ...conditionRules.commonRequirements];
}

export function getDefaultApprovalPath(conditionRules: CibConditionRules): CibApprovalPath {
  return conditionRules.approvalPaths.find((p) => p.id === 'gp_eeg') ?? conditionRules.approvalPaths[0];
}

const SPECIALIST_PATH_IDS = new Set(['neurologist', 'cardiology', 'pulmonology', 'rheumatology', 'psychiatry', 'haematology']);

/**
 * Conditions where schemes like Discovery require a specialist signature on the
 * initial CIB application — a GP cannot initiate the application even when
 * managing the patient long-term.
 */
export const SPECIALIST_SIGNATURE_REQUIRED_CONDITIONS = new Set([
  'Epilepsy',
  'Haemophilia',
  'Cardiomyopathy',
]);

/**
 * Returns true when the scheme mandates a specialist signature on the CIB
 * application for this condition, regardless of who is managing the patient.
 */
export function requiresSpecialistCibSignature(conditionName: string): boolean {
  const key = normalizeConditionName(conditionName);
  for (const name of SPECIALIST_SIGNATURE_REQUIRED_CONDITIONS) {
    if (normalizeConditionName(name) === key) return true;
  }
  return false;
}

/**
 * Resolves the correct CIB approval path given the practitioner role and,
 * optionally, the explicit ownership decision recorded after a specialist
 * assessment (e.g. post-EEG referral outcome).
 *
 * Ownership wins over role when provided:
 * - 'specialist_accepted' → force specialist path
 * - 'gp_retained' → force GP path even if the logged-in role is specialist
 */
export function resolveApprovalPathForPractitioner(
  role: PractitionerRole,
  conditionRules: CibConditionRules,
  careOwnership?: 'pending_decision' | 'gp_retained' | 'specialist_accepted'
): string {
  // Explicit ownership decision takes precedence over practitioner role
  if (careOwnership === 'specialist_accepted') {
    const neuro = conditionRules.approvalPaths.find((p) => p.id === 'neurologist');
    if (neuro) return neuro.id;
    const specialistPath = conditionRules.approvalPaths.find(
      (p) => SPECIALIST_PATH_IDS.has(p.id) || p.requirements.some((r) => r.type === 'specialist_application')
    );
    if (specialistPath) return specialistPath.id;
  }

  if (careOwnership === 'gp_retained') {
    const gpPath = conditionRules.approvalPaths.find(
      (p) => p.id === 'gp_eeg' || p.id === 'standard' || p.requirements.some((r) => r.type === 'gp_application')
    );
    if (gpPath) return gpPath.id;
    return conditionRules.approvalPaths[0]?.id ?? 'standard';
  }

  // No explicit ownership — fall back to practitioner role
  if (role === 'neurologist') {
    const neuro = conditionRules.approvalPaths.find((p) => p.id === 'neurologist');
    if (neuro) return neuro.id;
  }

  if (role === 'specialist') {
    const specialistPath = conditionRules.approvalPaths.find(
      (p) => SPECIALIST_PATH_IDS.has(p.id) || p.requirements.some((r) => r.type === 'specialist_application')
    );
    if (specialistPath) return specialistPath.id;
  }

  const gpPath = conditionRules.approvalPaths.find(
    (p) => p.id === 'gp_eeg' || p.id === 'standard' || p.requirements.some((r) => r.type === 'gp_application')
  );
  if (gpPath) return gpPath.id;

  return conditionRules.approvalPaths[0]?.id ?? 'standard';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Catalogue conditions that must have CIB rules (Discovery Chronic Conditions.csv). */
export const CATALOGUE_CONDITIONS = [
  'Asthma',
  'Cardiac Failure',
  'Cardiomyopathy',
  'Chronic Obstructive Pulmonary Disease',
  'Chronic Renal Disease',
  'Diabetes Mellitus Type 1',
  'Diabetes Mellitus Type 2',
  'Epilepsy',
  'Haemophilia',
  'Hyperlipidaemia',
  'Hypertension',
  'Hypothyroidism',
] as const;

export function validateCatalogueCibCoverage(rules: CibConditionRules[]): {
  ok: boolean;
  missing: string[];
} {
  const ruleNames = new Set(
    rules.map((r) => normalizeConditionName(r.condition).toLowerCase())
  );
  const missing = CATALOGUE_CONDITIONS.filter(
    (c) => !ruleNames.has(normalizeConditionName(c).toLowerCase())
  );
  return { ok: missing.length === 0, missing: [...missing] };
}

/**
 * Restricts which catalogue conditions a practitioner's own workspace offers
 * when starting a new case (not a referral — referral-received cases are
 * scoped by RLS/token, not by this list). Roles absent from this map are
 * intentionally unrestricted (GP, generic "Other Specialist", and allied
 * roles that have no single-specialty condition set) and see the full
 * catalogue. Extend this map as new specialty roles are added.
 */
export const PRACTITIONER_ROLE_CONDITIONS: Partial<Record<PractitionerRole, string[]>> = {
  neurologist: ['Epilepsy'],
};

/** Returns the allowed condition names for a role, or null for "no restriction". */
export function getAllowedConditionsForRole(role: PractitionerRole): string[] | null {
  return PRACTITIONER_ROLE_CONDITIONS[role] ?? null;
}
