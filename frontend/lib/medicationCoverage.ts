import { MedicineItem, MedicalPlan, SelectedMedication, BenefitState, FundingSource } from '@/types';

export interface MedicationCoverageDecision {
  formularyStatus: 'listed' | 'unlisted';
  coverageDecision: 'full_cover' | 'cap_limited';
  copayRisk: boolean;
  coverageNote: string;
  cdaCapAmount?: number;
  /** Which benefit bucket will fund this medicine given the patient's current benefit state */
  fundingSource: FundingSource;
  /** True when the medicine qualifies as disease-modifying therapy under CIB policy */
  isDiseaseModifying: boolean;
  /** Warning when medicine was prescribed before CIB approval (funding lag scenario) */
  fundingLagWarning?: string;
  /** Note when medicine may not qualify as disease-modifying therapy under CIB */
  cibFundingNote?: string;
}

/**
 * Keywords in medicine class or name that signal disease-modifying (not symptomatic) therapy.
 * CIB only covers disease-modifying medicines — symptomatic-only medicines may not be chronic-funded.
 */
const DISEASE_MODIFYING_KEYWORDS = [
  'ace inhibitor', 'arb', 'angiotensin', 'beta blocker', 'statin', 'metformin',
  'insulin', 'thyroxine', 'dmard', 'biologic', 'immunosuppressant', 'inhaled corticosteroid',
  'bronchodilator', 'antiepileptic', 'antiretroviral', 'dmard', 'hydroxychloroquine',
  'sulfasalazine', 'methotrexate', 'leflunomide', 'losartan', 'amlodipine', 'atorvastatin',
  'rosuvastatin', 'lisinopril', 'enalapril', 'ramipril', 'bisoprolol', 'carvedilol',
  'furosemide', 'spironolactone', 'levothyroxine', 'salbutamol', 'tiotropium', 'fluticasone',
  'budesonide', 'salmeterol', 'formoterol', 'omeprazole', 'pantoprazole',
];

const deriveFundingSource = (
  formularyStatus: 'listed' | 'unlisted',
  benefitState: BenefitState | undefined
): FundingSource => {
  if (!benefitState || benefitState === 'unregistered') return 'day-to-day';
  if (benefitState === 'pending_cib_review') return 'pmb_pending';
  if (formularyStatus === 'unlisted') return 'msa';
  return 'chronic_benefit';
};

const deriveDiseaseModifying = (medicine: MedicineItem): boolean => {
  const source = `${medicine.medicineClass} ${medicine.activeIngredient} ${medicine.medicineNameAndStrength}`.toLowerCase();
  return DISEASE_MODIFYING_KEYWORDS.some((kw) => source.includes(kw));
};

const buildFundingLagWarning = (
  benefitState: BenefitState | undefined,
  fundingSource: FundingSource
): string | undefined => {
  if (benefitState === 'pending_cib_review' && fundingSource === 'pmb_pending') {
    return 'CIB application is pending. This medicine may be funded from day-to-day benefits or MSA until Discovery approves the chronic benefit. Retain proof of prescription date — retrospective chronic funding may apply once approved.';
  }
  if (!benefitState || benefitState === 'unregistered') {
    return 'No CIB registration exists yet. Clinically appropriate to prescribe now; expected funding is day-to-day until CIB is approved. Submit a CIB application to activate the chronic pathway.';
  }
  return undefined;
};

const buildCibFundingNote = (
  isDiseaseModifying: boolean,
  benefitState: BenefitState | undefined
): string | undefined => {
  if (!isDiseaseModifying) {
    return 'CIB covers disease-modifying therapy only. Symptomatic-only medicines may not be chronic-funded even if the condition is approved.';
  }
  if (benefitState && benefitState !== 'unregistered' && benefitState !== 'pending_cib_review') {
    return undefined;
  }
  return undefined;
};

export const parseCdaAmount = (raw: string): number | undefined => {
  const match = raw?.match(/R\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return undefined;
  const parsed = Number.parseFloat(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const deriveFormularyStatus = (medicine: MedicineItem): 'listed' | 'unlisted' => {
  if (medicine.formularyStatus) return medicine.formularyStatus;
  const source = `${medicine.medicineNameAndStrength} ${medicine.medicineClass}`.toLowerCase();
  if (
    source.includes('unlisted') ||
    source.includes('not listed') ||
    source.includes('non-formulary')
  ) {
    return 'unlisted';
  }
  return 'listed';
};

export const buildCoverageDecision = (
  medicine: MedicineItem,
  selectedPlan: MedicalPlan,
  benefitState?: BenefitState
): MedicationCoverageDecision => {
  const formularyStatus = deriveFormularyStatus(medicine);
  const cdaRaw =
    selectedPlan === 'Core' || selectedPlan === 'Priority' || selectedPlan === 'Saver'
      ? medicine.cdaCore
      : medicine.cdaExecutive || medicine.cdaCore;
  const cdaCapAmount = parseCdaAmount(cdaRaw);
  const fundingSource = deriveFundingSource(formularyStatus, benefitState);
  const isDiseaseModifying = deriveDiseaseModifying(medicine);
  const fundingLagWarning = buildFundingLagWarning(benefitState, fundingSource);
  const cibFundingNote = buildCibFundingNote(isDiseaseModifying, benefitState);

  const isChronicPathway =
    benefitState &&
    benefitState !== 'unregistered' &&
    benefitState !== 'pending_cib_review';

  if (formularyStatus === 'listed') {
    const coverageNote = isChronicPathway
      ? isDiseaseModifying
        ? 'Formulary listed — expected funding via Chronic Illness Benefit (disease-modifying).'
        : 'Formulary listed, but may not qualify as disease-modifying therapy under CIB.'
      : isDiseaseModifying
        ? 'Formulary listed. Safe to prescribe now; chronic funding activates after CIB approval.'
        : 'Formulary listed, but may not qualify as disease-modifying therapy under CIB.';
    return {
      formularyStatus,
      coverageDecision: 'full_cover',
      copayRisk: false,
      coverageNote,
      cdaCapAmount,
      fundingSource,
      isDiseaseModifying,
      fundingLagWarning,
      cibFundingNote,
    };
  }

  return {
    formularyStatus,
    coverageDecision: 'cap_limited',
    copayRisk: true,
    coverageNote: 'Unlisted medicine: cover is limited to CDA cap and may create a co-payment.',
    cdaCapAmount,
    fundingSource,
    isDiseaseModifying,
    fundingLagWarning,
    cibFundingNote,
  };
};

type MedicationInput = Partial<SelectedMedication> &
  Pick<SelectedMedication, 'medicineClass' | 'activeIngredient' | 'medicineNameAndStrength' | 'cdaAmount'>;

export const normalizeSelectedMedication = (medication: MedicationInput): SelectedMedication => {
  const formularyStatus = medication.formularyStatus ?? 'listed';
  const cdaCapAmount = medication.cdaCapAmount ?? parseCdaAmount(medication.cdaAmount);
  const coverageDecision =
    medication.coverageDecision ?? (formularyStatus === 'listed' ? 'full_cover' : 'cap_limited');
  const copayRisk = medication.copayRisk ?? formularyStatus === 'unlisted';
  const coverageNote =
    medication.coverageNote ??
    (formularyStatus === 'listed'
      ? 'Fully covered (formulary listed medicine).'
      : 'Unlisted medicine: cover is limited to CDA cap and may create a co-payment.');

  return {
    ...medication,
    formularyStatus,
    coverageDecision,
    copayRisk,
    coverageNote,
    cdaCapAmount,
    fundingSource: medication.fundingSource,
    isDiseaseModifying: medication.isDiseaseModifying,
    fundingLagWarning: medication.fundingLagWarning,
    cibFundingNote: medication.cibFundingNote,
  };
};
