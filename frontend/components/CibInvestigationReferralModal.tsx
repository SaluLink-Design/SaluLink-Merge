'use client';

import type { ActionTemplate } from '@/lib/cibRegistrationRules';
import type { InvestigationReferralInput } from '@/lib/investigationCoordination';
import CibInvestigationReferralForm from '@/components/CibInvestigationReferralForm';

interface CibInvestigationReferralModalProps {
  condition: string;
  template: ActionTemplate;
  caseId?: string;
  onClose: () => void;
  onConfirm: (referral: InvestigationReferralInput) => void;
  isSubmitting?: boolean;
}

/** @deprecated Prefer inline CibInvestigationReferralForm within ChronicRegistrationWorkspace */
const CibInvestigationReferralModal = ({
  condition,
  template,
  caseId,
  onClose,
  onConfirm,
  isSubmitting = false,
}: CibInvestigationReferralModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
    <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-5">
      <CibInvestigationReferralForm
        condition={condition}
        template={template}
        caseId={caseId}
        onCancel={onClose}
        onConfirm={onConfirm}
        isSubmitting={isSubmitting}
      />
    </div>
  </div>
);

export default CibInvestigationReferralModal;
