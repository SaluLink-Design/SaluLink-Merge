import type {
  ActionPhase,
  ActionStatus,
  CareAction,
  CareActivityTemplate,
  ChronicConditionCase,
  ChronicRegistrationStatus,
  CibConditionRules,
  CibEvidenceItem,
  RegistrationPhase,
  TreatmentBasketItem,
  TreatmentItem,
} from '@/types';
import { DataService } from '@/lib/dataService';
import {
  ActionTemplate,
  compileActionTemplate,
  getDefaultApprovalPath,
  getRequirementsForPath,
  requirementKey,
} from '@/lib/cibRegistrationRules';
import { normalizeConditionName } from '@/lib/conditionNames';
import { getTreatmentDocumentationStatus } from '@/lib/diagnosticEvidence';

export const TERMINAL_STATUSES: ActionStatus[] = ['evidence_received', 'complete'];

export const actionStatusLabel: Record<ActionStatus, string> = {
  not_started: 'Not Started',
  requested: 'Requested',
  awaiting_completion: 'Awaiting Completion',
  evidence_received: 'Evidence Received',
  complete: 'Complete',
};

export const actionStatusClass: Record<ActionStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600 border-slate-200',
  requested: 'bg-blue-50 text-blue-700 border-blue-200',
  awaiting_completion: 'bg-amber-50 text-amber-800 border-amber-200',
  evidence_received: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  complete: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export const ownerLabel: Record<CareAction['owner'], string> = {
  gp: 'GP',
  external: 'External Provider',
  specialist: 'Specialist',
  patient: 'Patient',
};

export function createCareActionId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createChronicCaseId(): string {
  return `cc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function buildCareActionFromTemplate(
  template: ActionTemplate,
  profileId: string,
  condition: string,
  phase: ActionPhase = 'registration',
  status: ActionStatus = 'not_started'
): CareAction {
  const now = new Date().toISOString();
  return {
    id: createCareActionId(),
    profileId,
    condition,
    phase,
    requirementRef: {
      source: phase === 'registration' ? 'cib-rules' : 'basket',
      type: template.requirementType,
      code: template.code,
      label: template.requirementLabel,
    },
    title: template.actionTitle,
    purpose: template.purpose,
    likelyProviders: template.likelyProviders,
    owner: template.defaultOwner,
    status,
    treatmentItemCode: template.code,
    createdAt: now,
    updatedAt: now,
  };
}

export interface WorkflowContext {
  icdCode?: string;
  diagnosisDate?: string;
  clinicalNote?: string;
  diagnosticTreatments?: TreatmentItem[];
  cibEvidence?: CibEvidenceItem[];
}

export function isWizardRequirementTemplate(template: ActionTemplate): boolean {
  if (template.autoResolvable) return false;
  if (template.requirementType === 'gp_application') return false;
  if (template.requirementType === 'specialist_application') return false;
  return true;
}

export function isExternalEvidenceTemplate(template: ActionTemplate): boolean {
  return template.requirementType === 'investigation' || template.requirementType === 'lab_result';
}

/** Shown in registration Evidence coordination (orders, referrals, specialist application pack) */
export function isRegistrationCoordinationTemplate(template: ActionTemplate): boolean {
  if (isExternalEvidenceTemplate(template)) return true;
  if (template.requirementType === 'specialist_application') return true;
  if (template.requirementType === 'supporting_diagnosis') return true;
  return false;
}

export function createCibEvidenceItemFromTemplate(template: ActionTemplate): CibEvidenceItem {
  return {
    code: template.code ?? template.requirementKey,
    description: template.requirementLabel,
    documentation: { notes: '', images: [] },
  };
}

export function findCibEvidenceItem(
  items: CibEvidenceItem[] | undefined,
  code?: string
): CibEvidenceItem | undefined {
  if (!code || !items?.length) return undefined;
  return items.find((i) => i.code === code);
}

export function isAutoRequirementMet(
  template: ActionTemplate,
  ctx: WorkflowContext
): boolean {
  if (!template.autoResolvable) return false;
  switch (template.requirementType) {
    case 'icd_confirmed':
      return Boolean(ctx.icdCode?.trim());
    case 'diagnosis_date':
      return Boolean(ctx.diagnosisDate?.trim());
    case 'clinical_notes':
      return Boolean(ctx.clinicalNote?.trim());
    default:
      return false;
  }
}

export function findActionForRequirement(
  actions: CareAction[],
  reqKey: string
): CareAction | undefined {
  return actions.find(
    (a) =>
      requirementKey({
        type: a.requirementRef.type as ActionTemplate['requirementType'],
        label: a.requirementRef.label,
        code: a.requirementRef.code,
      }) === reqKey ||
      `${a.requirementRef.type}:${a.requirementRef.code ?? ''}` === reqKey
  );
}

export function isRequirementSatisfied(
  template: ActionTemplate,
  actions: CareAction[],
  ctx: WorkflowContext
): boolean {
  if (isAutoRequirementMet(template, ctx)) return true;

  const action = findActionForRequirement(actions, template.requirementKey);
  if (action && TERMINAL_STATUSES.includes(action.status)) return true;

  if (
    template.requirementType === 'gp_application' ||
    template.requirementType === 'specialist_application'
  ) {
    const externalActions = actions.filter(
      (a) =>
        a.phase === 'registration' &&
        (a.requirementRef.type === 'investigation' || a.requirementRef.type === 'lab_result')
    );
    if (externalActions.length === 0) return false;

    const externalDone = externalActions.every((a) => {
      if (TERMINAL_STATUSES.includes(a.status)) return true;
      if (a.treatmentItemCode && ctx.cibEvidence?.length) {
        const match = findCibEvidenceItem(ctx.cibEvidence, a.treatmentItemCode);
        if (match) {
          const docStatus = getTreatmentDocumentationStatus(match as TreatmentItem);
          if (docStatus.documented && a.evidence?.interpretationNotes?.trim()) return true;
        }
      }
      return false;
    });

    return (
      externalDone &&
      Boolean(ctx.icdCode?.trim()) &&
      Boolean(ctx.diagnosisDate?.trim()) &&
      Boolean(ctx.clinicalNote?.trim())
    );
  }

  if (template.code && ctx.cibEvidence?.length) {
    const match = findCibEvidenceItem(ctx.cibEvidence, template.code);
    if (match) {
      const docStatus = getTreatmentDocumentationStatus(match as TreatmentItem);
      if (docStatus.documented && action?.evidence?.interpretationNotes?.trim()) return true;
      if (action && (action.status === 'requested' || action.status === 'awaiting_completion')) {
        return false;
      }
    }
  }

  if (template.code && ctx.diagnosticTreatments?.length) {
    const match = ctx.diagnosticTreatments.find(
      (t) => t.code === template.code || t.description.toLowerCase().includes(template.code!.toLowerCase())
    );
    if (match) {
      const docStatus = getTreatmentDocumentationStatus(match);
      if (docStatus.documented) return true;
      if (action && (action.status === 'requested' || action.status === 'awaiting_completion')) {
        return false;
      }
    }
  }

  return false;
}

export interface RegistrationProgress {
  total: number;
  completed: number;
  percent: number;
  items: { label: string; satisfied: boolean; requirementKey: string }[];
}

export function computeRegistrationProgress(
  templates: ActionTemplate[],
  actions: CareAction[],
  ctx: WorkflowContext
): RegistrationProgress {
  const items = templates.map((t) => ({
    label: t.requirementLabel,
    satisfied: isRequirementSatisfied(t, actions, ctx),
    requirementKey: t.requirementKey,
  }));
  const completed = items.filter((i) => i.satisfied).length;
  const total = items.length;
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    items,
  };
}

export function canSubmitCibRegistration(progress: RegistrationProgress): {
  ok: boolean;
  reason?: string;
} {
  if (progress.total === 0) {
    return { ok: true };
  }
  if (progress.percent < 100) {
    const pending = progress.items.filter((i) => !i.satisfied).map((i) => i.label);
    return {
      ok: false,
      reason: `Registration incomplete (${progress.percent}%). Outstanding: ${pending.join(', ')}`,
    };
  }
  return { ok: true };
}

export function getNextStatus(current: ActionStatus, owner: CareAction['owner']): ActionStatus | null {
  switch (current) {
    case 'not_started':
      return 'requested';
    case 'requested':
      return owner === 'external' ? 'awaiting_completion' : 'evidence_received';
    case 'awaiting_completion':
      return 'evidence_received';
    case 'evidence_received':
      return 'complete';
    default:
      return null;
  }
}

export function getAdvanceActionLabel(current: ActionStatus, owner: CareAction['owner']): string {
  const next = getNextStatus(current, owner);
  if (!next) return '';
  if (current === 'not_started') return 'Start Action';
  if (next === 'awaiting_completion') return 'Mark Awaiting Completion';
  if (next === 'evidence_received') return 'Mark Evidence Received';
  if (next === 'complete') return 'Mark Complete';
  return 'Advance';
}

const INVESTIGATION_TYPES = new Set(['investigation', 'lab_result']);

export function isInvestigationAction(action: CareAction): boolean {
  return INVESTIGATION_TYPES.has(action.requirementRef.type);
}

export function getActionStatusLabel(action: CareAction): string {
  if (isInvestigationAction(action)) {
    switch (action.status) {
      case 'not_started':
        return 'Not Ordered';
      case 'requested':
        return 'Ordered';
      case 'awaiting_completion':
        return 'Awaiting Results';
      case 'evidence_received':
        return 'Evidence Received';
      case 'complete':
        return 'Complete';
      default:
        return actionStatusLabel[action.status];
    }
  }
  return actionStatusLabel[action.status];
}

export function getPrimaryCtaLabel(action: CareAction): string | null {
  const next = getNextStatus(action.status, action.owner);
  if (!next) return null;

  if (isInvestigationAction(action)) {
    switch (action.status) {
      case 'not_started':
        return 'Order Investigation';
      case 'requested':
        return null;
      case 'awaiting_completion':
        return action.owner === 'external' ? null : 'Upload Results';
      default:
        return getAdvanceActionLabel(action.status, action.owner);
    }
  }

  if (action.requirementRef.type === 'gp_application') {
    return null;
  }

  if (action.requirementRef.type === 'specialist_application') {
    switch (action.status) {
      case 'not_started':
        return 'Start application pack';
      case 'requested':
        return 'Mark application in progress';
      default:
        return getAdvanceActionLabel(action.status, action.owner);
    }
  }

  if (action.phase !== 'registration') {
    if (action.status === 'not_started') return 'Start Activity';
    return getAdvanceActionLabel(action.status, action.owner);
  }

  if (action.status === 'not_started') return 'Start Action';
  return getAdvanceActionLabel(action.status, action.owner);
}

export function getInvestigationBasketItems(
  condition: string,
  code?: string
): TreatmentBasketItem[] {
  const items = DataService.getDiagnosticBasketForCondition(condition);
  if (!code) return items;
  return items.filter(
    (item) =>
      item.diagnosticBasket.code.trim() === code ||
      item.diagnosticBasket.description.toLowerCase().includes(code.toLowerCase())
  );
}

export function getNextRegistrationAction(
  templates: ActionTemplate[],
  actions: CareAction[],
  ctx: WorkflowContext
): { template: ActionTemplate; action: CareAction | undefined } | null {
  const prioritized = [
    ...templates.filter((t) => isExternalEvidenceTemplate(t)),
    ...templates.filter((t) => t.requirementType === 'specialist_application'),
    ...templates.filter(
      (t) =>
        isWizardRequirementTemplate(t) &&
        !isExternalEvidenceTemplate(t) &&
        t.requirementType !== 'supporting_diagnosis'
    ),
    ...templates.filter((t) => t.requirementType === 'supporting_diagnosis'),
  ];

  for (const template of prioritized) {
    if (template.autoResolvable && isAutoRequirementMet(template, ctx)) continue;
    if (template.requirementType === 'gp_application') continue;
    if (template.requirementType === 'specialist_application') continue;
    if (isRequirementSatisfied(template, actions, ctx)) continue;
    const action = findActionForRequirement(actions, template.requirementKey);
    return { template, action };
  }
  return null;
}

export function allExternalEvidenceOrdered(
  templates: ActionTemplate[],
  actions: CareAction[]
): boolean {
  const external = templates.filter(isExternalEvidenceTemplate);
  if (external.length === 0) return true;
  return external.every((t) => {
    const action = findActionForRequirement(actions, t.requirementKey);
    return action && action.status !== 'not_started';
  });
}

export function deriveRegistrationPhase(
  chronicCase: ChronicConditionCase | undefined,
  templates: ActionTemplate[],
  actions: CareAction[],
  ctx: WorkflowContext
): RegistrationPhase {
  const phase = chronicCase?.registrationPhase ?? 'not_started';
  if (phase === 'ready_to_submit') return 'ready_to_submit';
  if (phase === 'application_overview') return 'application_overview';

  const externalTemplates = templates.filter(isExternalEvidenceTemplate);
  const orders = chronicCase?.investigationOrders ?? [];

  if (!allExternalEvidenceOrdered(templates, actions)) {
    return 'requirements';
  }

  if (orders.some((o) => o.status === 'ordered')) {
    return 'awaiting_results';
  }

  const externalActions = actions.filter(
    (a) =>
      a.phase === 'registration' &&
      (a.requirementRef.type === 'investigation' || a.requirementRef.type === 'lab_result')
  );
  const needsInterpretation = externalActions.some(
    (a) =>
      a.status === 'awaiting_completion' &&
      orders.find((o) => o.actionId === a.id)?.status === 'results_received' &&
      !a.evidence?.interpretationNotes?.trim()
  );
  if (needsInterpretation) return 'interpretation';

  const externalSatisfied = externalTemplates.every((t) =>
    isRequirementSatisfied(t, actions, ctx)
  );
  if (externalSatisfied && (!ctx.icdCode || !ctx.diagnosisDate)) {
    return 'icd_code';
  }
  if (externalSatisfied && ctx.icdCode && ctx.diagnosisDate) {
    return 'medication';
  }

  if (phase === 'not_started') return 'application_overview';
  return phase;
}

export function createTreatmentItemFromBasket(item: TreatmentBasketItem): TreatmentItem {
  return {
    description: item.diagnosticBasket.description,
    code: item.diagnosticBasket.code,
    maxCovered: parseInt(item.diagnosticBasket.covered, 10) || 1,
    timesCompleted: 1,
    documentation: { notes: '', images: [] },
  };
}

export function spawnRegistrationActions(
  chronicCase: ChronicConditionCase,
  conditionRules: CibConditionRules,
  approvalPathId: string
): CareAction[] {
  const templates = getRequirementsForPath(conditionRules, approvalPathId).map(compileActionTemplate);
  const existing = chronicCase.careActions.filter((a) => a.phase === 'registration');
  const toAdd: CareAction[] = [];

  for (const template of templates) {
    if (template.autoResolvable) continue;
    if (findActionForRequirement(existing, template.requirementKey)) continue;
    toAdd.push(
      buildCareActionFromTemplate(
        template,
        chronicCase.profileId,
        chronicCase.condition,
        'registration',
        'not_started'
      )
    );
  }

  return toAdd;
}

export function buildPathwayActionFromActivity(
  activity: CareActivityTemplate,
  profileId: string,
  condition: string
): CareAction {
  const now = new Date().toISOString();
  const phase = activity.phase === 'ongoing' ? 'ongoing' : 'pathway';
  return {
    id: createCareActionId(),
    profileId,
    condition,
    phase,
    requirementRef: {
      source: 'basket',
      type: `activity:${activity.id}`,
      code: activity.code,
      label: activity.title,
    },
    title:
      activity.title.includes('Review') || activity.title.includes('Consultation')
        ? activity.title
        : activity.title,
    purpose: activity.purpose,
    likelyProviders: [activity.provider],
    owner: activity.provider.toLowerCase().includes('gp') ? 'gp' : 'external',
    status: 'not_started',
    treatmentItemCode: activity.code,
    createdAt: now,
    updatedAt: now,
  };
}

export function materializePathwayActivities(chronicCase: ChronicConditionCase): CareAction[] {
  const activities = getCareActivitiesForCondition(chronicCase.condition);
  const existing = chronicCase.careActions.filter((a) => a.phase === 'pathway' || a.phase === 'ongoing');
  const toAdd: CareAction[] = [];

  for (const activity of activities) {
    const alreadyExists = existing.some(
      (a) =>
        a.requirementRef.type === `activity:${activity.id}` ||
        (activity.code && a.treatmentItemCode === activity.code && a.title === activity.title)
    );
    if (alreadyExists) continue;
    toAdd.push(buildPathwayActionFromActivity(activity, chronicCase.profileId, chronicCase.condition));
  }

  return toAdd;
}

export function isRegistrationUnlocked(
  chronicCase: ChronicConditionCase | undefined,
  cibApproved: boolean
): boolean {
  if (cibApproved) return true;
  if (!chronicCase) return false;
  const status = chronicCase.registrationStatus ?? 'not_started';
  return status === 'complete' || status === 'submitted';
}

export function deriveRegistrationStatus(
  progress: RegistrationProgress,
  current?: ChronicRegistrationStatus
): ChronicRegistrationStatus {
  if (current === 'submitted') return 'submitted';
  if (progress.total === 0) return current === 'in_progress' ? 'in_progress' : 'not_started';
  if (progress.percent === 100) return 'complete';
  if (progress.percent > 0 || current === 'in_progress') return 'in_progress';
  return 'not_started';
}

export function syncActionsFromCibEvidence(chronicCase: ChronicConditionCase): CareAction[] {
  const now = new Date().toISOString();
  const evidence = chronicCase.cibEvidence ?? [];
  return chronicCase.careActions.map((action) => {
    if (!action.treatmentItemCode || TERMINAL_STATUSES.includes(action.status)) {
      return action;
    }
    const match = findCibEvidenceItem(evidence, action.treatmentItemCode);
    if (!match) return action;
    const docStatus = getTreatmentDocumentationStatus(match as TreatmentItem);
    const order = chronicCase.investigationOrders?.find((o) => o.actionId === action.id);
    const hasInterpretation = Boolean(action.evidence?.interpretationNotes?.trim());

    if (order?.status === 'results_received' && !hasInterpretation) {
      return {
        ...action,
        status: 'awaiting_completion' as ActionStatus,
        evidence: {
          ...action.evidence,
          notes: order.rawFindings ?? match.documentation.notes,
          orderedAt: action.evidence?.orderedAt ?? order.orderedAt,
        },
        updatedAt: now,
      };
    }

    if (docStatus.documented && hasInterpretation) {
      return {
        ...action,
        status: 'evidence_received' as ActionStatus,
        evidence: {
          ...action.evidence,
          notes: order?.rawFindings ?? match.documentation.notes,
          interpretationNotes: action.evidence?.interpretationNotes,
          completedAt: now,
        },
        updatedAt: now,
      };
    }
    return action;
  });
}

export function syncActionsFromDiagnostics(
  chronicCase: ChronicConditionCase,
  diagnosticTreatments: TreatmentItem[]
): CareAction[] {
  const now = new Date().toISOString();
  return chronicCase.careActions.map((action) => {
    if (!action.treatmentItemCode || TERMINAL_STATUSES.includes(action.status)) {
      return action;
    }
    const match = diagnosticTreatments.find((t) => t.code === action.treatmentItemCode);
    if (!match) return action;
    const docStatus = getTreatmentDocumentationStatus(match);
    if (!docStatus.documented) return action;
    return {
      ...action,
      status: 'evidence_received' as ActionStatus,
      evidence: {
        ...action.evidence,
        notes: match.documentation.notes || action.evidence?.notes,
        completedAt: now,
      },
      updatedAt: now,
    };
  });
}

export function getCareActivitiesForCondition(condition: string): CareActivityTemplate[] {
  const key = normalizeConditionName(condition).toLowerCase();
  const diagnostic = DataService.getDiagnosticBasketForCondition(condition);
  const ongoing = DataService.getOngoingBasketForCondition(condition);

  const activities: CareActivityTemplate[] = [];

  diagnostic.forEach((item, i) => {
    const desc = item.diagnosticBasket.description.trim();
    const code = item.diagnosticBasket.code.trim();
    if (!desc) return;
    activities.push({
      id: `diag-${key}-${code || i}`,
      title: desc,
      provider: inferProvider(desc, item.specialists),
      purpose: 'Diagnostic assessment',
      code,
      phase: 'pathway',
    });
  });

  ongoing.forEach((item, i) => {
    const desc = item.ongoingManagementBasket.description.trim();
    const code = item.ongoingManagementBasket.code.trim();
    if (!desc) return;
    activities.push({
      id: `ongo-${key}-${code || i}`,
      title: desc,
      provider: inferProvider(desc, item.specialists),
      purpose: 'Ongoing chronic management',
      code,
      phase: 'ongoing',
    });
  });

  const specialists = ongoing[0]?.specialists ?? diagnostic[0]?.specialists;
  if (specialists?.trim()) {
    activities.push({
      id: `spec-${key}`,
      title: `${specialists.trim()} Consultation`,
      provider: specialists.trim(),
      purpose: 'Specialist review and pathway oversight',
      phase: 'pathway',
    });
  }

  activities.push({
    id: `med-${key}`,
    title: 'Medication Review',
    provider: 'GP / Specialist',
    purpose: 'Review chronic medication and formulary alignment',
    phase: 'ongoing',
  });

  activities.push({
    id: `fu-${key}`,
    title: 'Follow-up Assessment',
    provider: 'GP',
    purpose: 'Routine chronic condition review',
    phase: 'ongoing',
  });

  return activities;
}

function inferProvider(description: string, specialists?: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('eeg') || lower.includes('neuro')) return 'Clinical Technologist';
  if (lower.includes('consult')) return specialists?.trim() || 'Specialist';
  if (lower.includes('gp') || lower.includes('practitioner')) return 'Medical Practitioner';
  return specialists?.trim() || 'Clinical Provider';
}

export interface PathwayStatusItem {
  label: string;
  complete: boolean;
}

export function buildSchemePathwayStatus(
  condition: string,
  chronicCase: ChronicConditionCase | undefined,
  cibApproved: boolean,
  ctx: WorkflowContext
): PathwayStatusItem[] {
  const registrationActions = chronicCase?.careActions.filter((a) => a.phase === 'registration') ?? [];
  const registrationStatus = chronicCase?.registrationStatus ?? 'not_started';

  const hasRegistrationStarted =
    registrationStatus !== 'not_started' ||
    registrationActions.length > 0 ||
    Boolean(ctx.icdCode?.trim());

  const investigationActions = registrationActions.filter(
    (a) => a.requirementRef.type === 'investigation' || a.requirementRef.type === 'lab_result'
  );
  const hasInvestigationRequested = investigationActions.some((a) => a.status !== 'not_started');
  const hasInvestigationCompleted = investigationActions.some((a) =>
    TERMINAL_STATUSES.includes(a.status)
  );

  const specialistActions = registrationActions.filter(
    (a) => a.requirementRef.type === 'specialist_application'
  );
  const hasSpecialistReview = Boolean(
    specialistActions.some((a) => TERMINAL_STATUSES.includes(a.status)) ||
      chronicCase?.careActions.some(
        (a) =>
          a.phase !== 'registration' &&
          a.title.toLowerCase().includes('consult') &&
          TERMINAL_STATUSES.includes(a.status)
      )
  );

  const registrationSubmitted =
    registrationStatus === 'submitted' || chronicCase?.submissionStatus === 'submitted';

  return [
    { label: 'Condition identified', complete: true },
    { label: 'Registration started', complete: hasRegistrationStarted },
    { label: 'Investigation requested', complete: hasInvestigationRequested },
    { label: 'Investigation completed', complete: hasInvestigationCompleted },
    { label: 'Specialist review', complete: hasSpecialistReview },
    { label: 'Registration submitted', complete: registrationSubmitted },
    { label: 'Benefit activated', complete: cibApproved },
  ];
}

export { compileActionTemplate, getDefaultApprovalPath, getRequirementsForPath, requirementKey, resolveApprovalPathForPractitioner } from '@/lib/cibRegistrationRules';
