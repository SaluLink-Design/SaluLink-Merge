import type { CareAction, PractitionerRole } from '@/types';
import type { ActionTemplate } from '@/lib/cibRegistrationRules';
import { isInvestigationAction } from '@/lib/careActions';

export type InvestigationCoordinationType = 'order' | 'referral';

export interface InvestigationReferralInput {
  urgency: 'routine' | 'urgent' | 'emergency';
  referralNote: string;
  specialistType: string;
  /** GP defaults to retaining ownership; specialist explicitly accepts handover after EEG assessment */
  careOwnership: 'pending_decision' | 'gp_retained' | 'specialist_accepted';
  /** Real case_referrals.id from Supabase — required for SpecialistOutcomePanel to update the correct row. */
  referralId?: string;
  /** Shareable token the GP sends to the specialist's own account to accept cross-workspace access. */
  referralToken?: string;
  /** True when the specialist was selected from the directory and the referral is already delivered — no link to copy/send. */
  deliveredDirectly?: boolean;
  /** Directory-selected specialist's workspace id, set directly on case_referrals.target_workspace_id at creation. */
  targetWorkspaceId?: string;
}

export function getInvestigationShortName(template: ActionTemplate): string {
  const label = template.requirementLabel.toLowerCase();
  if (label.includes('eeg')) return 'EEG';
  if (template.code) return template.code;
  return template.requirementLabel.split('(')[0]?.trim() || template.requirementLabel;
}

export function shouldGpReferForInvestigation(
  template: ActionTemplate,
  practitionerRole: PractitionerRole
): boolean {
  return practitionerRole === 'gp' && template.gpPathway === 'referral';
}

export function getInvestigationCoordinationType(
  template: ActionTemplate,
  practitionerRole: PractitionerRole
): InvestigationCoordinationType {
  return shouldGpReferForInvestigation(template, practitionerRole) ? 'referral' : 'order';
}

export function getInvestigationCtaLabel(
  template: ActionTemplate,
  practitionerRole: PractitionerRole,
  action?: CareAction
): string | null {
  if (!action || !isInvestigationAction(action)) return null;

  if (action.status === 'not_started') {
    if (shouldGpReferForInvestigation(template, practitionerRole)) {
      return `Refer for ${getInvestigationShortName(template)}`;
    }
    if (template.requirementType === 'lab_result') {
      return `Order ${template.code ?? 'Laboratory Test'}`;
    }
    return 'Order Investigation';
  }

  if (action.status === 'requested' || action.status === 'awaiting_completion') {
    return null;
  }

  return null;
}

export function defaultReferralSpecialty(template: ActionTemplate): string {
  if (template.referralSpecialty) {
    return template.referralSpecialty.charAt(0).toUpperCase() + template.referralSpecialty.slice(1);
  }
  if (template.requirementLabel.toLowerCase().includes('eeg')) return 'Neurology';
  return 'Specialist';
}

/**
 * Synthesizes a minimal ActionTemplate for an ongoing-management basket item so the
 * same referral form/flow used by CIB registration (CibInvestigationReferralForm) can
 * be reused for follow-up-visit referrals, instead of maintaining a second referral UI.
 */
export function buildOngoingReferralTemplate(code: string, label: string): ActionTemplate {
  const isEeg = code.trim().split(/\s+/)[0] === '2711' || label.toLowerCase().includes('eeg');
  return {
    requirementKey: `ongoing:${code}`,
    requirementLabel: label,
    requirementType: 'investigation',
    actionTitle: `Refer for ${isEeg ? 'EEG' : label}`,
    purpose: isEeg
      ? 'EEG is not performed in general practice. Refer to neurology or a neurodiagnostic unit.'
      : 'Refer to the appropriate specialist service for this investigation.',
    likelyProviders: isEeg
      ? ['Neurology / Neurodiagnostic Unit', 'Clinical Technologist']
      : ['Specialist', 'Clinical Technologist'],
    defaultOwner: 'external',
    code,
    autoResolvable: false,
    gpPathway: 'referral',
    referralSpecialty: isEeg ? 'neurology' : undefined,
    performer: isEeg ? 'clinical_technologist' : undefined,
    interpreter: isEeg ? 'neurologist' : undefined,
  };
}

export function buildDefaultReferralNote(condition: string, template: ActionTemplate): string {
  const testName = template.requirementLabel;
  return (
    `Referral for ${testName} + specialist assessment to support CIB registration for ${condition}. ` +
    `GP retains primary management unless specialist confirms ongoing specialist chronic management ` +
    `is required and accepts handover in writing. Please perform ${testName} and return report + ` +
    `management plan if specialist-level care is not indicated.`
  );
}
