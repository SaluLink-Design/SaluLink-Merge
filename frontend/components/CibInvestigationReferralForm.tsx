'use client';

import { useEffect, useRef, useState } from 'react';
import { Info, Check, Copy, Search, Building2 } from 'lucide-react';
import type { ActionTemplate } from '@/lib/cibRegistrationRules';
import {
  buildDefaultReferralNote,
  defaultReferralSpecialty,
  type InvestigationReferralInput,
} from '@/lib/investigationCoordination';
import { buildReferralUrl, saveReferralToDatabase } from '@/lib/caseService';
import { searchSpecialistDirectory, type SpecialistDirectoryEntry } from '@/lib/specialistDirectory';

interface CibInvestigationReferralFormProps {
  condition: string;
  template: ActionTemplate;
  caseId?: string;
  onCancel: () => void;
  onConfirm: (referral: InvestigationReferralInput) => void;
  isSubmitting?: boolean;
  /** When true, omits top border — form is embedded inside a parent card */
  embedded?: boolean;
}

const CibInvestigationReferralForm = ({
  condition,
  template,
  caseId,
  onCancel,
  onConfirm,
  isSubmitting = false,
  embedded = false,
}: CibInvestigationReferralFormProps) => {
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [specialistType, setSpecialistType] = useState(defaultReferralSpecialty(template));
  const [referralNote, setReferralNote] = useState(buildDefaultReferralNote(condition, template));
  const [isSaving, setIsSaving] = useState(false);
  const [createdReferral, setCreatedReferral] = useState<InvestigationReferralInput | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Registered specialist delivery is the primary path. External link sharing
  // is an explicit fallback, never an accidental consequence of free text.
  const [deliveryMode, setDeliveryMode] = useState<'directory' | 'external'>('directory');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryResults, setDirectoryResults] = useState<SpecialistDirectoryEntry[]>([]);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState<SpecialistDirectoryEntry | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSequenceRef = useRef(0);
  const isCibRegistrationReferral = !template.requirementKey.startsWith('ongoing:');

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const handleSpecialistTypeChange = (value: string) => {
    setDirectoryQuery(value);
    setSelectedSpecialist(null);
    setDirectoryError(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const sequence = ++searchSequenceRef.current;

    if (!value.trim()) {
      setDirectoryResults([]);
      setDirectoryOpen(false);
      setDirectoryLoading(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setDirectoryLoading(true);
      try {
        const results = await searchSpecialistDirectory(value.trim());
        if (sequence !== searchSequenceRef.current) return;
        setDirectoryResults(results);
        setDirectoryOpen(true);
      } catch {
        if (sequence !== searchSequenceRef.current) return;
        setDirectoryResults([]);
        setDirectoryOpen(false);
        setDirectoryError('Directory search failed. Retry, or use the external referral fallback.');
      } finally {
        if (sequence === searchSequenceRef.current) setDirectoryLoading(false);
      }
    }, 300);
  };

  const handleSelectSpecialist = (entry: SpecialistDirectoryEntry) => {
    setSelectedSpecialist(entry);
    setDirectoryQuery(entry.displayName);
    setSpecialistType(
      `${entry.displayName}${entry.speciality ? ` — ${entry.speciality}` : ''} (${entry.workspaceName})`
    );
    setDirectoryOpen(false);
  };

  const handleConfirm = async () => {
    setSaveError(null);
    if (deliveryMode === 'directory' && !selectedSpecialist) {
      setSaveError('Select a registered specialist before sending this referral.');
      return;
    }
    const referral: InvestigationReferralInput = {
      urgency,
      specialistType: specialistType.trim(),
      referralNote: referralNote.trim(),
      careOwnership: 'pending_decision',
    };

    if (caseId) {
      setIsSaving(true);
      try {
        const result = await saveReferralToDatabase({
          caseId,
          specialistType: referral.specialistType,
          urgency: referral.urgency,
          notes: referral.referralNote,
          careOwnership: 'pending_decision',
          targetWorkspaceId: deliveryMode === 'directory' ? selectedSpecialist?.workspaceId : undefined,
        });
        if (result.success) {
          referral.referralId = result.referralId;
          referral.referralToken = result.referralToken;
          if (deliveryMode === 'directory' && selectedSpecialist) {
            referral.deliveredDirectly = true;
            referral.targetWorkspaceId = selectedSpecialist.workspaceId;
          }
        } else {
          // A referral with no token can never be accepted by a specialist —
          // this must block, not silently continue in local-only state.
          console.error('Referral DB save failed:', result.error);
          setSaveError(
            result.error ?? 'Could not create the referral. Please check your connection and try again.'
          );
          setIsSaving(false);
          return;
        }
      } catch (err) {
        console.error('Referral DB save threw:', err);
        setSaveError(
          err instanceof Error ? err.message : 'Could not create the referral. Please check your connection and try again.'
        );
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    // If we got a real token, pause here so the GP can grab the link before
    // the form closes — this is the only place that link is ever shown.
    if (referral.referralToken) {
      setCreatedReferral(referral);
      return;
    }

    onConfirm(referral);
  };

  const handleCopyLink = async () => {
    if (!createdReferral?.referralToken) return;
    try {
      await navigator.clipboard.writeText(buildReferralUrl(createdReferral.referralToken));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  const busy = isSubmitting || isSaving;

  if (createdReferral) {
    return (
      <div
        className={
          embedded
            ? 'mt-4 pt-4 border-t border-indigo-200 space-y-4'
            : 'rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4'
        }
      >
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900">
            {createdReferral.deliveredDirectly
              ? `Referral delivered to ${createdReferral.specialistType || 'the specialist'}`
              : `Referral created — send this link to ${createdReferral.specialistType || 'the specialist'}`}
          </h3>
        </div>

        {createdReferral.deliveredDirectly ? (
          <p className="text-sm text-slate-600">
            This referral now appears in that specialist&apos;s referral inbox automatically — nothing further to
            send. They can open it from their own SaluLink account.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Opening this link from their own SaluLink account grants them access to this one case only —
              it does not add them to your workspace or expose any other patient.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                aria-label="Referral link"
                title="Referral link"
                className="input-field flex-1 font-mono text-xs"
                value={buildReferralUrl(createdReferral.referralToken ?? '')}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn-secondary px-4 py-2 flex items-center gap-2 shrink-0"
              >
                <Copy className="w-4 h-4" />
                {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy link'}
              </button>
            </div>
          </>
        )}

        {isCibRegistrationReferral && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
            <p className="font-semibold">CIB is now waiting for specialist completion.</p>
            <p className="mt-1 text-xs leading-relaxed">
              No further GP action is required at this stage. The patient case will remain in your
              workspace and will notify you when the specialist completes the CIB registration.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onConfirm(createdReferral)}
            className="btn-primary px-6 py-2"
          >
            {isCibRegistrationReferral ? 'Close CIB and return to workspace' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? 'mt-4 pt-4 border-t border-indigo-200 space-y-4'
          : 'rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 space-y-4'
      }
    >
      <div>
        <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">
          Referral details
        </p>
        <p className="text-sm text-slate-600 mt-1">{template.requirementLabel}</p>
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm text-violet-800">
        GPs cannot perform or interpret this investigation in practice. Refer to a specialist service
        {template.performer ? ` (${template.performer.replace(/_/g, ' ')})` : ''} and track results here
        for CIB registration.
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex gap-3 text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <strong>GP retains care ownership by default.</strong> The specialist will confirm after assessment
          whether they accept handover for ongoing chronic management, or return the patient to you with the
          report for CIB submission.
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDeliveryMode('directory')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              deliveryMode === 'directory'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            Send to registered specialist
          </button>
          <button
            type="button"
            onClick={() => {
              setDeliveryMode('external');
              setSelectedSpecialist(null);
              setDirectoryOpen(false);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              deliveryMode === 'external'
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            External specialist link
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {deliveryMode === 'directory' ? (
          <div className="relative">
          <label htmlFor="refer-specialist" className="label">
            Search registered specialists
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="refer-specialist"
              className="input-field pl-9"
              value={directoryQuery}
              onChange={(e) => handleSpecialistTypeChange(e.target.value)}
              onFocus={() => setDirectoryOpen(directoryResults.length > 0)}
              placeholder="Search by name, specialty, or role…"
              autoComplete="off"
            />
          </div>
          {selectedSpecialist && (
            <p className="mt-1 text-xs text-emerald-700 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Delivered directly to this specialist&apos;s inbox — no link needed.
            </p>
          )}
          {!selectedSpecialist && !directoryError && (
            <p className="mt-1 text-xs text-slate-400">
              {directoryLoading
                ? 'Searching directory…'
                : directoryQuery.trim()
                  ? 'Select a result to deliver directly. No result? Use the external specialist link.'
                  : 'Choose a registered specialist for automatic inbox delivery.'}
            </p>
          )}
          {directoryError && <p className="mt-1 text-xs text-rose-600">{directoryError}</p>}
          {directoryOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
              {directoryResults.length === 0 && !directoryLoading ? (
                <p className="px-3 py-3 text-sm text-slate-500">
                  No registered specialist matched this search.
                </p>
              ) : directoryResults.map((entry) => (
                <button
                  key={entry.profileId}
                  type="button"
                  onClick={() => handleSelectSpecialist(entry)}
                  className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0"
                >
                  <p className="text-sm font-medium text-slate-900">{entry.displayName}</p>
                  <p className="text-xs text-slate-500">
                    {[entry.speciality, entry.practitionerRole?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                    {entry.workspaceName ? ` — ${entry.workspaceName}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        ) : (
          <div>
            <label htmlFor="refer-specialist" className="label">
              External specialist or service
            </label>
            <input
              id="refer-specialist"
              className="input-field"
              value={specialistType}
              onChange={(event) => setSpecialistType(event.target.value)}
              placeholder="e.g. Neurology service"
            />
            <p className="mt-1 text-xs text-amber-700">
              Use this only when the specialist is not registered on SaluLink. You will need to
              send them the generated secure link.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="refer-urgency" className="label">
            Urgency
          </label>
          <select
            id="refer-urgency"
            className="input-field"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as typeof urgency)}
          >
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
        </div>
      </div>

      <div>
        <label htmlFor="refer-note" className="label">
          Referral note
        </label>
        <textarea
          id="refer-note"
          className="textarea-field"
          rows={5}
          value={referralNote}
          onChange={(e) => setReferralNote(e.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1">
          Ownership statement is pre-filled. Edit only if your scheme requires specific wording.
        </p>
      </div>

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError} No referral was created — retry before leaving this screen.
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary px-4 py-2" disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          disabled={
            busy ||
            !referralNote.trim() ||
            (deliveryMode === 'directory' ? !selectedSpecialist : !specialistType.trim())
          }
          onClick={handleConfirm}
          className="btn-primary px-6 py-2 disabled:opacity-50"
        >
          {busy
            ? 'Referring…'
            : saveError
              ? 'Retry referral'
              : deliveryMode === 'directory'
                ? 'Send referral'
                : 'Create referral link'}
        </button>
      </div>
    </div>
  );
};

export default CibInvestigationReferralForm;
