import type { PractitionerRole } from '@/types';

export type OngoingCoordinationType = 'referral' | 'order' | 'document';

export type OngoingBasketCategory = 'monitoring_tests' | 'interpretation_reports' | 'other';

export type OngoingBasketPrimaryCta = 'refer' | 'order' | 'document' | 'interpret';

export interface OngoingBasketRoleHint {
  label: string;
  hint: string;
  primaryCta?: OngoingBasketPrimaryCta;
}

export interface OngoingBasketRule {
  code: string;
  category: OngoingBasketCategory;
  coordinationType: OngoingCoordinationType;
  assignedTo: string[];
  clinicalHint: string;
  roleHints?: Partial<Record<PractitionerRole, OngoingBasketRoleHint>>;
}

export interface OngoingBasketItemHint {
  code: string;
  category: OngoingBasketCategory;
  coordinationType: OngoingCoordinationType;
  coordinationLabel: string;
  assignedTo: string[];
  clinicalHint: string;
}

export interface RoleAwareBasketHint extends OngoingBasketItemHint {
  primaryCta: OngoingBasketPrimaryCta | null;
  assigneeLabel: string;
}

interface OngoingBasketRulesFile {
  version: string;
  items: OngoingBasketRule[];
  defaults: Omit<OngoingBasketRule, 'code'>;
}

const COORDINATION_LABELS: Record<OngoingCoordinationType, string> = {
  referral: 'Refer out',
  order: 'Order in practice',
  document: 'Document only',
};

const CATEGORY_LABELS: Record<OngoingBasketCategory, string> = {
  monitoring_tests: 'Monitoring tests',
  interpretation_reports: 'Interpretation & reports',
  other: 'Other monitoring',
};

const SPECIALIST_ROLES: PractitionerRole[] = ['neurologist', 'specialist'];

function isSpecialistRole(role: PractitionerRole): boolean {
  return SPECIALIST_ROLES.includes(role);
}

function normalizeCode(code: string): string {
  return code.trim().split(/\s+/)[0] ?? code.trim();
}

function isEegCode(code: string, description: string): boolean {
  const lower = description.toLowerCase();
  return normalizeCode(code) === '2711' || lower.includes('eeg') || lower.includes('encephalogram');
}

/** Compact card title — e.g. EEG catalogue lines collapse to the procedure name. */
export function getBasketDisplayTitle(description: string, code = ''): string {
  const normalized = description.replace(/\s+/g, ' ').trim();
  const normalizedCode = normalizeCode(code);
  if (normalizedCode === '2712' || /interpretation and report/i.test(normalized)) {
    return 'EEG interpretation';
  }
  if (isEegCode(code, normalized)) {
    const match = normalized.match(/^(Electro-encephalogram\s*\(EEG\))/i);
    return match?.[1] ?? 'Electro-encephalogram (EEG)';
  }
  return normalized;
}

/** Full catalogue wording shown in the expanded panel when it differs from the short title. */
export function getBasketDetailDescription(description: string, code = ''): string | null {
  const normalized = description.replace(/\s+/g, ' ').trim();
  const title = getBasketDisplayTitle(normalized, code);
  if (normalized === title) return null;
  return normalized;
}

function isInterpretationItem(code: string, description: string, category: OngoingBasketCategory): boolean {
  if (category === 'interpretation_reports') return true;
  const lower = description.toLowerCase();
  return normalizeCode(code) === '2712' || lower.includes('interpretation and report');
}

function inferPrimaryCta(
  rule: OngoingBasketRule,
  role: PractitionerRole,
  code: string,
  description: string
): OngoingBasketPrimaryCta | null {
  if (isInterpretationItem(code, description, rule.category)) {
    return isSpecialistRole(role) || role === 'clinical_technologist' ? 'interpret' : 'document';
  }

  if (rule.coordinationType === 'order') {
    if (role === 'clinical_technologist') return 'document';
    return 'order';
  }

  if (rule.coordinationType === 'referral') {
    if (isSpecialistRole(role) && isEegCode(code, description)) return 'order';
    if (role === 'gp') return 'refer';
    if (isSpecialistRole(role)) return 'refer';
    return 'document';
  }

  return 'document';
}

function inferRoleLabel(
  rule: OngoingBasketRule,
  role: PractitionerRole,
  code: string,
  description: string,
  primaryCta: OngoingBasketPrimaryCta | null
): string {
  if (primaryCta === 'refer' && isEegCode(code, description)) return 'Refer for EEG';
  if (primaryCta === 'order' && isEegCode(code, description)) return 'Order EEG';
  if (primaryCta === 'order' && rule.coordinationType === 'order') return 'Order lab';
  if (primaryCta === 'interpret') return 'Document interpretation';
  if (primaryCta === 'refer') return 'Refer out';
  if (primaryCta === 'order') return 'Order in practice';
  return COORDINATION_LABELS[rule.coordinationType];
}

function resolveRoleKey(role: PractitionerRole): PractitionerRole {
  if (role === 'neurologist') return 'neurologist';
  if (role === 'specialist') return 'specialist';
  return role;
}

let rulesCache: OngoingBasketRulesFile | null = null;

export function invalidateOngoingBasketRulesCache(): void {
  rulesCache = null;
}

export async function loadOngoingBasketRules(): Promise<OngoingBasketRulesFile> {
  if (rulesCache) return rulesCache;
  const res = await fetch(`/ongoing-basket-rules.json?v=${Date.now()}`);
  if (!res.ok) throw new Error('Failed to load ongoing basket rules');
  rulesCache = (await res.json()) as OngoingBasketRulesFile;
  return rulesCache;
}

function resolveRule(
  rules: OngoingBasketRulesFile,
  code: string,
  description: string
): OngoingBasketRule {
  const normalized = normalizeCode(code);
  const byCode = rules.items.find((item) => normalizeCode(item.code) === normalized);
  if (byCode) return byCode;

  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('interpretation') || lowerDesc.includes('report of item')) {
    return {
      code: normalized,
      category: 'interpretation_reports',
      coordinationType: 'referral',
      assignedTo: ['Specialist'],
      clinicalHint: rules.defaults.clinicalHint,
    };
  }

  return {
    code: normalized,
    ...rules.defaults,
    category: rules.defaults.category as OngoingBasketCategory,
  };
}

export function getBasketItemHintFromRules(
  rules: OngoingBasketRulesFile,
  code: string,
  description: string
): OngoingBasketItemHint {
  const rule = resolveRule(rules, code, description);
  return {
    code: rule.code,
    category: rule.category,
    coordinationType: rule.coordinationType,
    coordinationLabel: COORDINATION_LABELS[rule.coordinationType],
    assignedTo: rule.assignedTo,
    clinicalHint: rule.clinicalHint,
  };
}

export function getRoleAwareBasketHintFromRules(
  rules: OngoingBasketRulesFile,
  code: string,
  description: string,
  practitionerRole: PractitionerRole = 'gp'
): RoleAwareBasketHint {
  const rule = resolveRule(rules, code, description);
  const roleKey = resolveRoleKey(practitionerRole);
  const roleOverride = rule.roleHints?.[roleKey] ?? rule.roleHints?.[practitionerRole];

  const primaryCta =
    roleOverride?.primaryCta ??
    inferPrimaryCta(rule, practitionerRole, code, description);

  const coordinationLabel =
    roleOverride?.label ??
    inferRoleLabel(rule, practitionerRole, code, description, primaryCta);

  const clinicalHint = roleOverride?.hint ?? rule.clinicalHint;

  const assigneeLabel =
    primaryCta === 'order' && isEegCode(code, description)
      ? 'Clinical Technologist'
      : rule.assignedTo[0] ?? 'Clinical Provider';

  return {
    code: rule.code,
    category: rule.category,
    coordinationType: rule.coordinationType,
    coordinationLabel,
    assignedTo: rule.assignedTo,
    clinicalHint,
    primaryCta,
    assigneeLabel,
  };
}

export async function getBasketItemHint(
  code: string,
  description: string
): Promise<OngoingBasketItemHint> {
  const rules = await loadOngoingBasketRules();
  return getBasketItemHintFromRules(rules, code, description);
}

export async function getRoleAwareBasketHint(
  code: string,
  description: string,
  practitionerRole: PractitionerRole = 'gp'
): Promise<RoleAwareBasketHint> {
  const rules = await loadOngoingBasketRules();
  return getRoleAwareBasketHintFromRules(rules, code, description, practitionerRole);
}

export function getCategoryLabel(category: OngoingBasketCategory): string {
  return CATEGORY_LABELS[category] ?? CATEGORY_LABELS.other;
}

export const ONGOING_CATEGORY_ORDER: OngoingBasketCategory[] = [
  'monitoring_tests',
  'interpretation_reports',
  'other',
];
