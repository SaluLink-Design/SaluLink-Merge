/** Canonical PMB condition labels used in CSV datasets. */
const CANONICAL_CONDITION_NAMES: Record<string, string> = {
  'diabetes mellitus type 1': 'Diabetes Mellitus Type 1',
  'diabetes mellitus type 2': 'Diabetes Mellitus Type 2',
  'diabetes mellitus type i': 'Diabetes Mellitus Type 1',
  'diabetes mellitus type ii': 'Diabetes Mellitus Type 2',
  'cardiac failure': 'Cardiac Failure',
  'chronic renal disease': 'Chronic Renal Disease',
  'chronic obstructive pulmonary disease': 'Chronic Obstructive Pulmonary Disease',
  'hyperlipidaemia': 'Hyperlipidaemia',
  'hyperlipidemia': 'Hyperlipidaemia',
  'hypothyroidism': 'Hypothyroidism',
  'hypertension': 'Hypertension',
  'asthma': 'Asthma',
  'epilepsy': 'Epilepsy',
  'haemophilia': 'Haemophilia',
  'hemophilia': 'Haemophilia',
  'cardiomyopathy': 'Cardiomyopathy',
};

/** Map stored / Authi labels to the exact CSV condition name. */
export function normalizeConditionName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return CANONICAL_CONDITION_NAMES[trimmed.toLowerCase()] ?? trimmed;
}
