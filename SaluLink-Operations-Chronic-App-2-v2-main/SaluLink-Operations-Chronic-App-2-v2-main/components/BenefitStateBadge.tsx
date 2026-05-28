'use client';

import { BenefitState, CibRecord } from '@/types';
import { benefitStateLabel, isWorkflowA } from '@/lib/benefitState';
import { ChevronDown, ChevronUp, FilePlus2 } from 'lucide-react';
import { useState } from 'react';

const STATE_STYLES: Record<BenefitState, string> = {
  unregistered: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_cib_review: 'bg-amber-50 text-amber-800 border-amber-200',
  approved_chronic: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  formulary_compliant: 'bg-teal-50 text-teal-800 border-teal-200',
  pmb_compliant: 'bg-blue-50 text-blue-800 border-blue-200',
  dsp_compliant: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

interface BenefitStateBadgeProps {
  cibRecords: CibRecord[];
  expanded?: boolean;
  showActions?: boolean;
  onOpenCibAssistant?: (conditionName: string) => void;
  onUpdateBenefitState?: (conditionName: string, benefitState: BenefitState) => void;
}

const BenefitStateBadge = ({
  cibRecords,
  expanded: defaultExpanded = false,
  showActions = false,
  onOpenCibAssistant,
  onUpdateBenefitState,
}: BenefitStateBadgeProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (cibRecords.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No chronic conditions registered on CIB yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {cibRecords.map((rec) => (
        <div
          key={rec.conditionName}
          className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900 text-sm">{rec.conditionName}</p>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">{rec.icd10}</p>
            </div>
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${STATE_STYLES[rec.benefitState]}`}
            >
              {benefitStateLabel[rec.benefitState]}
            </span>
          </div>

          {(expanded || defaultExpanded) && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              {rec.diagnosisDate && (
                <>
                  <dt className="text-slate-400">Diagnosis date</dt>
                  <dd className="font-medium text-slate-800">{rec.diagnosisDate}</dd>
                </>
              )}
              {rec.submissionDate && (
                <>
                  <dt className="text-slate-400">CIB submitted</dt>
                  <dd className="font-medium text-slate-800">{rec.submissionDate}</dd>
                </>
              )}
              {rec.approvalDate && (
                <>
                  <dt className="text-slate-400">CIB approved</dt>
                  <dd className="font-medium text-slate-800">{rec.approvalDate}</dd>
                </>
              )}
              {rec.submittedMedicine && (
                <>
                  <dt className="text-slate-400">Submitted medicine</dt>
                  <dd className="font-medium text-slate-800 col-span-1">{rec.submittedMedicine}</dd>
                </>
              )}
            </dl>
          )}

          {showActions && (
            <div className="mt-3 flex flex-wrap gap-2">
              {isWorkflowA(rec.benefitState) && onOpenCibAssistant && (
                <button
                  type="button"
                  onClick={() => onOpenCibAssistant(rec.conditionName)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold authi-gradient text-white"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  CIB application
                </button>
              )}
              {onUpdateBenefitState && (
                <select
                  aria-label={`Benefit state for ${rec.conditionName}`}
                  value={rec.benefitState}
                  onChange={(e) =>
                    onUpdateBenefitState(rec.conditionName, e.target.value as BenefitState)
                  }
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  {(Object.keys(benefitStateLabel) as BenefitState[]).map((s) => (
                    <option key={s} value={s}>
                      {benefitStateLabel[s]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {showActions && rec.fundingLagNote && (
            <p className="mt-2 text-xs text-amber-700 leading-relaxed">{rec.fundingLagNote}</p>
          )}
        </div>
      ))}

      {!defaultExpanded && cibRecords.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Show less' : 'Show details'}
        </button>
      )}
    </div>
  );
};

export default BenefitStateBadge;
