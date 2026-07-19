'use client';

import { useState } from 'react';
import { CheckCircle2, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import type { CareOwnership } from '@/lib/caseService';
import { updateReferralOwnership } from '@/lib/caseService';
import { requiresSpecialistCibSignature } from '@/lib/cibRegistrationRules';

export interface SpecialistOutcomeResult {
  careOwnership: 'gp_retained' | 'specialist_accepted';
  specialistOutcomeNote: string;
}

interface SpecialistOutcomePanelProps {
  referralId?: string;
  specialistType: string;
  condition: string;
  onDecisionConfirmed: (result: SpecialistOutcomeResult) => void;
  /** When true, renders as inline section inside a parent card */
  embedded?: boolean;
}

const SpecialistOutcomePanel = ({
  referralId,
  specialistType,
  condition,
  onDecisionConfirmed,
  embedded = false,
}: SpecialistOutcomePanelProps) => {
  const [selected, setSelected] = useState<'gp_retained' | 'specialist_accepted' | null>(null);
  const [outcomeNote, setOutcomeNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsSpecialistCib = requiresSpecialistCibSignature(condition);

  const canConfirm = selected !== null && outcomeNote.trim().length > 0;

  const handleConfirm = async () => {
    if (!canConfirm || !selected) return;
    setError(null);
    setIsSaving(true);

    if (referralId) {
      const result = await updateReferralOwnership({
        referralId,
        careOwnership: selected,
        specialistOutcomeNote: outcomeNote.trim(),
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to record specialist outcome. Please try again.');
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    onDecisionConfirmed({
      careOwnership: selected,
      specialistOutcomeNote: outcomeNote.trim(),
    });
  };

  return (
    <div
      className={
        embedded
          ? 'pt-4 mt-4 border-t border-slate-200 space-y-5'
          : 'rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-5'
      }
    >
      <div>
        <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">
          Care ownership decision
        </p>
        <h3 className="text-base font-semibold text-slate-900 mt-1">Post-assessment outcome</h3>
        <p className="text-sm text-slate-500 mt-1">
          After assessing <span className="font-medium text-slate-700">{condition}</span>
          {specialistType ? ` (${specialistType})` : ''}, confirm whether you are accepting chronic
          management or returning the patient to the referring GP.
        </p>
      </div>

      {/* Decision buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setSelected('specialist_accepted')}
          className={[
            'rounded-xl border-2 p-4 text-left transition-colors',
            selected === 'specialist_accepted'
              ? 'border-violet-500 bg-violet-50'
              : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50',
          ].join(' ')}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2
              className={`w-5 h-5 ${selected === 'specialist_accepted' ? 'text-violet-600' : 'text-slate-300'}`}
            />
            <span className="text-sm font-semibold text-slate-900">Specialist accepts management</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Complex condition confirmed. Specialist initiates and signs the CIB application. GP may
            continue script renewals once stabilised.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelected('gp_retained')}
          className={[
            'rounded-xl border-2 p-4 text-left transition-colors',
            selected === 'gp_retained'
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50',
          ].join(' ')}
        >
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeft
              className={`w-5 h-5 ${selected === 'gp_retained' ? 'text-emerald-600' : 'text-slate-300'}`}
            />
            <span className="text-sm font-semibold text-slate-900">Return to GP for routine care</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {needsSpecialistCib
              ? 'Patient returns to GP for repeat scripts and day-to-day monitoring. You must complete and sign the CIB registration before this handoff — the scheme requires specialist sign-off for this condition.'
              : 'Condition manageable in general practice. Send EEG report + interpretation to GP, who completes and submits the CIB application.'}
          </p>
        </button>
      </div>

      {/* EEG / Investigation findings & outcome note */}
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
          EEG / Investigation findings
        </p>
        <label htmlFor="specialist-outcome-note" className="label">
          {selected === 'specialist_accepted'
            ? 'Findings, diagnosis confirmation & specialist management plan'
            : selected === 'gp_retained'
            ? 'Findings, interpretation & recommendations for GP'
            : 'Investigation findings, diagnosis status & management recommendation'}
          <span className="text-red-500 ml-1">*</span>
        </label>
        <textarea
          id="specialist-outcome-note"
          className="textarea-field"
          rows={8}
          placeholder={
            selected === 'specialist_accepted'
              ? `e.g. EEG confirms focal epileptiform discharges in the left temporal region consistent with focal epilepsy. Diagnosis established. Initiating specialist CIB pathway for ${condition}. Commencing carbamazepine under neurology supervision. Annual review scheduled.`
              : selected === 'gp_retained'
              ? `e.g. EEG within normal limits / non-specific findings. No epileptiform activity identified. No specialist-level chronic management required at this stage. Full report attached. GP may proceed with ${condition} CIB registration using this report as supporting evidence.`
              : `Record EEG findings, diagnosis status, and management recommendation for ${condition}…`
          }
          value={outcomeNote}
          onChange={(e) => setOutcomeNote(e.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1">
          This note forms part of the CIB evidence pack. Be specific about findings — vague notes delay
          scheme approval and are insufficient for Discovery Health CDL registration.
        </p>
      </div>

      {/* Scheme note — specialist_accepted always; gp_retained only for specialist-signature conditions */}
      {(selected === 'specialist_accepted' || (selected === 'gp_retained' && needsSpecialistCib)) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex gap-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {selected === 'specialist_accepted' ? (
              <>
                <strong>Scheme note:</strong> Discovery Health requires a specialist signature on the
                initial CIB application for {condition}. Complete the registration steps (ICD-10, diagnosis
                date, medication) before returning this patient to the GP for routine follow-up.
              </>
            ) : (
              <>
                <strong>Scheme note:</strong> Even when returning routine care to the GP, Discovery Health
                requires your specialist signature on the CIB form for {condition}. You must complete the
                CIB registration steps before confirming this handoff — the GP cannot sign alone for this
                condition.
              </>
            )}
          </span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canConfirm || isSaving}
          onClick={handleConfirm}
          className="btn-primary px-6 py-2 disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSaving ? 'Recording decision…' : 'Confirm decision'}
        </button>
      </div>
    </div>
  );
};

export default SpecialistOutcomePanel;
export type { CareOwnership };
