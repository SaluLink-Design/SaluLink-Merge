import type {
  CareAction,
  InvestigationAssigneeRole,
  InvestigationOrder,
  InvestigationOrderStatus,
  PractitionerRole,
} from '@/types';
import type { InvestigationCoordinationType } from '@/lib/investigationCoordination';

export interface BuildInvestigationOrderOptions {
  coordinationType?: InvestigationCoordinationType;
  referredAt?: string;
  referredByRole?: PractitionerRole;
  referralId?: string;
  referralSpecialty?: string;
}

export function createInvestigationOrderId(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function inferAssigneeRole(action: CareAction): InvestigationAssigneeRole {
  const provider = action.likelyProviders[0]?.toLowerCase() ?? '';
  if (
    provider.includes('patholog') ||
    provider.includes('laboratory') ||
    action.requirementRef.type === 'lab_result'
  ) {
    return 'pathologist';
  }
  return 'clinical_technologist';
}

export function buildInvestigationOrder(
  action: CareAction,
  opts: BuildInvestigationOrderOptions = {}
): InvestigationOrder {
  const now = new Date().toISOString();
  const coordinationType = opts.coordinationType ?? 'order';
  return {
    id: createInvestigationOrderId(),
    actionId: action.id,
    treatmentCode: action.treatmentItemCode ?? action.requirementRef.code ?? '',
    label: action.requirementRef.label,
    assigneeRole: inferAssigneeRole(action),
    status: 'ordered',
    orderedAt: coordinationType === 'referral' ? opts.referredAt ?? now : now,
    coordinationType,
    referredAt: opts.referredAt,
    referredByRole: opts.referredByRole,
    referralId: opts.referralId,
    referralSpecialty: opts.referralSpecialty,
  };
}

export function getOrderForAction(
  orders: InvestigationOrder[] | undefined,
  actionId: string
): InvestigationOrder | undefined {
  return orders?.find((o) => o.actionId === actionId);
}

export function allOrdersResultsReceived(orders: InvestigationOrder[]): boolean {
  if (orders.length === 0) return false;
  return orders.every((o) => o.status === 'results_received');
}

export function mockResultsPayload(
  order?: Pick<InvestigationOrder, 'treatmentCode' | 'label' | 'assigneeRole'>
): {
  rawFindings: string;
  resultsFiles: string[];
} {
  const code = normalizeTreatmentCode(order?.treatmentCode);
  const isDrugLevel =
    code === '4081' ||
    order?.assigneeRole === 'pathologist' ||
    (order?.label ?? '').toLowerCase().includes('drug level');

  if (isDrugLevel) {
    return {
      rawFindings:
        'Therapeutic drug level (pathology): Carbamazepine 8.4 µg/mL (reference 4–12). Sample received and assayed by laboratory. Formal lab report attached.',
      resultsFiles: ['mock-drug-level-report.pdf'],
    };
  }

  return {
    rawFindings:
      'EEG: Generalised spike-and-wave discharges at 3 Hz. Findings consistent with epileptiform activity. Full report attached.',
    resultsFiles: ['mock-eeg-report.pdf'],
  };
}

export function canMockExternalProvider(): boolean {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MOCK_EXTERNAL_PROVIDER === 'true') {
    return true;
  }
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return true;
  }
  return false;
}

export function canUploadEvidence(
  practitionerRole: PractitionerRole,
  action: CareAction
): boolean {
  if (action.owner === 'gp') return true;
  if (action.status !== 'awaiting_completion' && action.status !== 'requested') return false;
  if (practitionerRole === 'clinical_technologist' || practitionerRole === 'pathologist') {
    return true;
  }
  return false;
}

export function canOrderInvestigation(practitionerRole: PractitionerRole): boolean {
  return practitionerRole === 'gp' || practitionerRole === 'neurologist' || practitionerRole === 'specialist';
}

export function applyMockResultsToOrder(order: InvestigationOrder): InvestigationOrder {
  const payload = mockResultsPayload(order);
  return {
    ...order,
    status: 'results_received' as InvestigationOrderStatus,
    resultsReceivedAt: new Date().toISOString(),
    rawFindings: payload.rawFindings,
    resultsFiles: payload.resultsFiles,
  };
}

export function normalizeTreatmentCode(code: string | null | undefined): string {
  if (!code) return '';
  const trimmed = code.trim();
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function inferAssigneeRoleFromProviders(providers: string[], code: string): InvestigationAssigneeRole {
  const joined = providers.join(' ').toLowerCase();
  if (joined.includes('patholog') || joined.includes('laboratory')) {
    return 'pathologist';
  }
  if (normalizeTreatmentCode(code) === '4081' || normalizeTreatmentCode(code) === '3755') {
    return 'pathologist';
  }
  return 'clinical_technologist';
}

export interface BuildOngoingBasketOrderInput {
  treatmentCode: string;
  label: string;
  caseId: string;
  assigneeRole: InvestigationAssigneeRole;
  coordinationType?: InvestigationCoordinationType;
  referredByRole?: PractitionerRole;
  /** Real case_referrals.id from Supabase — set when a genuine referral (not a local mock) was created. */
  referralId?: string;
  referralSpecialty?: string;
}

export function buildOngoingBasketOrder(input: BuildOngoingBasketOrderInput): InvestigationOrder {
  const now = new Date().toISOString();
  const coordinationType = input.coordinationType ?? 'order';
  return {
    id: createInvestigationOrderId(),
    actionId: `basket_${normalizeTreatmentCode(input.treatmentCode)}_${Date.now()}`,
    treatmentCode: input.treatmentCode,
    label: input.label,
    assigneeRole: input.assigneeRole,
    status: 'ordered',
    orderedAt: now,
    visitContext: 'ongoing',
    caseId: input.caseId,
    coordinationType,
    referredAt: coordinationType === 'referral' ? now : undefined,
    referredByRole: input.referredByRole,
    referralId: input.referralId,
    referralSpecialty: input.referralSpecialty,
  };
}

export function getOrderForTreatmentCode(
  orders: InvestigationOrder[] | undefined,
  treatmentCode: string
): InvestigationOrder | undefined {
  const normalized = normalizeTreatmentCode(treatmentCode);
  const matching = (orders ?? []).filter(
    (o) => normalizeTreatmentCode(o.treatmentCode) === normalized
  );
  if (matching.length === 0) return undefined;
  return matching.sort(
    (a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()
  )[0];
}

export function hasPendingOrderForCode(
  orders: InvestigationOrder[] | undefined,
  treatmentCode: string
): boolean {
  const order = getOrderForTreatmentCode(orders, treatmentCode);
  return order?.status === 'ordered';
}
