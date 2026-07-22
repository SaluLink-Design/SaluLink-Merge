'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Inbox, Link2, Loader2, Send, ArrowUpRight, BadgeCheck } from 'lucide-react';
import {
  acceptCaseReferral,
  fetchInboundReferrals,
  fetchOutboundReferrals,
  getReferralProgress,
  markReferralOpened,
  type InboundReferralSummary,
} from '@/lib/caseService';
import SpecialistCaseWorkspace from '@/components/SpecialistCaseWorkspace';
import { useAuth } from '@/lib/AuthContext';
import { splitReferralNotesAndFindings } from '@/lib/medicationReportSummary';

interface ReferralInboxProps {
  workspaceId: string;
  /** Prefills the accept box, e.g. when arriving via /referrals?token=... */
  initialToken?: string;
  /** Lets the parent page hide its own header/padding chrome while the full-page case workspace is open. */
  onWorkspaceOpenChange?: (open: boolean) => void;
}

const urgencyBadge: Record<string, string> = {
  routine: 'bg-slate-100 text-slate-600 border-slate-200',
  urgent: 'bg-amber-100 text-amber-700 border-amber-200',
  emergency: 'bg-rose-100 text-rose-700 border-rose-200',
};

const ReferralInbox = ({ workspaceId, initialToken = '', onWorkspaceOpenChange }: ReferralInboxProps) => {
  const auth = useAuth();

  const roleLabel: Record<string, string> = {
    neurologist: 'Neurology Practice',
    gp: 'General Practice',
    specialist: 'Specialist Practice',
  };
  const practiceLabel =
    roleLabel[auth.profile?.practitionerRole ?? ''] ?? 'Medical Practice';

  const [tab, setTab] = useState<'inbound' | 'outbound'>('inbound');
  const [inbound, setInbound] = useState<InboundReferralSummary[]>([]);
  const [outbound, setOutbound] = useState<InboundReferralSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptMessage, setAcceptMessage] = useState<string | null>(null);

  /** ID of the referral currently open in the full-screen workspace */
  const [workspaceReferralId, setWorkspaceReferralId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [inboundResult, outboundResult] = await Promise.all([
      fetchInboundReferrals(workspaceId),
      fetchOutboundReferrals(workspaceId),
    ]);
    if (inboundResult.success) setInbound(inboundResult.referrals);
    if (outboundResult.success) setOutbound(outboundResult.referrals);
    setIsLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAccept = async () => {
    const raw = tokenInput.trim();
    if (!raw) return;
    const token = raw.includes('token=')
      ? new URL(raw, 'https://placeholder.local').searchParams.get('token') ?? raw
      : raw;

    setIsAccepting(true);
    setAcceptError(null);
    setAcceptMessage(null);
    const result = await acceptCaseReferral(token);
    setIsAccepting(false);

    if (!result.success) {
      setAcceptError(result.error ?? 'Could not accept this referral link.');
      return;
    }

    setAcceptMessage('Referral accepted — the case now appears in your inbound list below.');
    setTokenInput('');
    await load();
  };

  useEffect(() => {
    if (initialToken) {
      void handleAccept();
    }
    // Only run once on mount for the URL-provided token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Full-screen workspace takeover ──────────────────────────────────────

  const activeReferral =
    workspaceReferralId !== null
      ? [...inbound, ...outbound].find((r) => r.referralId === workspaceReferralId)
      : null;

  const onWorkspaceOpenChangeRef = useRef(onWorkspaceOpenChange);
  onWorkspaceOpenChangeRef.current = onWorkspaceOpenChange;

  useEffect(() => {
    onWorkspaceOpenChangeRef.current?.(Boolean(activeReferral));
  }, [activeReferral]);

  const handleWorkspaceCompleted = useCallback(() => {
    const completedReferralId = workspaceReferralId;
    setWorkspaceReferralId(null);
    onWorkspaceOpenChangeRef.current?.(false);

    if (completedReferralId) {
      const stamp = new Date().toISOString();
      setInbound((prev) =>
        prev.map((r) =>
          r.referralId === completedReferralId
            ? { ...r, registrationCompletedAt: r.registrationCompletedAt ?? stamp }
            : r
        )
      );
    }

    void load();
  }, [workspaceReferralId, load]);

  const openReferral = async (referral: InboundReferralSummary) => {
    setWorkspaceReferralId(referral.referralId);
    if (referral.openedAt) return;

    const optimisticOpenedAt = new Date().toISOString();
    setInbound((prev) =>
      prev.map((item) =>
        item.referralId === referral.referralId
          ? { ...item, openedAt: optimisticOpenedAt }
          : item
      )
    );
    const result = await markReferralOpened(referral.referralId);
    if (!result.success) {
      setInbound((prev) =>
        prev.map((item) =>
          item.referralId === referral.referralId ? { ...item, openedAt: null } : item
        )
      );
    }
  };

  if (workspaceReferralId && !activeReferral) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 px-6">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">
          {isLoading ? 'Loading referral…' : 'Could not open this referral.'}
        </p>
        {!isLoading && (
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-sm"
            onClick={() => setWorkspaceReferralId(null)}
          >
            Back to referrals
          </button>
        )}
      </div>
    );
  }

  if (activeReferral) {
    return (
      <SpecialistCaseWorkspace
        referral={activeReferral}
        practiceLabel={practiceLabel}
        onClose={() => {
          setWorkspaceReferralId(null);
          onWorkspaceOpenChangeRef.current?.(false);
        }}
        onCompleted={handleWorkspaceCompleted}
      />
    );
  }

  // ─── Referral card ────────────────────────────────────────────────────────

  const renderReferralCard = (
    referral: InboundReferralSummary,
    direction: 'inbound' | 'outbound'
  ) => {
    const isRegistered = Boolean(referral.registrationCompletedAt);
    const progress = getReferralProgress(referral);
    const statusBadge = progress === 'completed'
      ? { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
      : referral.careOwnership === 'specialist_accepted'
        ? { label: 'Accepted management', className: 'bg-violet-100 text-violet-700 border-violet-200' }
        : referral.careOwnership === 'gp_retained'
          ? { label: 'Returned to GP', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
          : direction === 'outbound'
            ? progress === 'opened'
              ? { label: 'Opened by specialist', className: 'bg-blue-100 text-blue-700 border-blue-200' }
              : progress === 'delivered'
                ? { label: 'Delivered', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
                : { label: 'Sent — link not accepted', className: 'bg-amber-100 text-amber-700 border-amber-200' }
            : progress === 'opened'
              ? { label: 'Opened', className: 'bg-blue-100 text-blue-700 border-blue-200' }
              : { label: 'New referral', className: 'bg-amber-100 text-amber-700 border-amber-200' };

    return (
      <div
        key={referral.referralId}
        className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {referral.patientName || 'Unnamed patient'}{' '}
              <span className="text-slate-400 font-normal">
                · {referral.patientId || 'No ID on file'}
              </span>
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              {referral.conditionName || 'Condition not set'}
              {referral.icdCode ? ` · ${referral.icdCode}` : ' · ICD-10 to be confirmed by specialist'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                urgencyBadge[referral.urgency] ?? urgencyBadge.routine
              }`}
            >
              {referral.urgency}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          </div>
        </div>

        {referral.clinicalNote && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
              GP&apos;s clinical note
            </p>
            <p className="whitespace-pre-wrap line-clamp-3">{referral.clinicalNote}</p>
          </div>
        )}

        {referral.notes && (
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
              Referral message
            </p>
            <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-2">
              {splitReferralNotesAndFindings(referral.notes).referralMessage || referral.notes}
            </p>
            {splitReferralNotesAndFindings(referral.notes).medicationFindings && (
              <p className="text-xs text-violet-700 mt-1 font-medium">
                Includes medication report findings
              </p>
            )}
          </div>
        )}

        {referral.specialistOutcomeNote && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
              Specialist outcome note
            </p>
            <p className="line-clamp-2">{referral.specialistOutcomeNote}</p>
          </div>
        )}

        {isRegistered && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
            <BadgeCheck className="w-4 h-4" />
            CIB registration submitted
            {referral.registrationCompletedAt
              ? ` · ${new Date(referral.registrationCompletedAt).toLocaleDateString('en-ZA')}`
              : ''}
          </div>
        )}

        {direction === 'inbound' && !isRegistered && (
          <button
            type="button"
            onClick={() => void openReferral(referral)}
            className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4" />
            Open referral
          </button>
        )}

        {direction === 'inbound' && isRegistered && (
          <button
            type="button"
            onClick={() => void openReferral(referral)}
            className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4" />
            View referral
          </button>
        )}
      </div>
    );
  };

  // ─── Main list view ───────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-6 pb-10">
      {/* Explicit fallback for specialists who were not selected from the directory. */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">External referral fallback</h2>
        </div>
        <p className="text-sm text-slate-600">
          If a GP could not find your registered account, paste the secure link they sent you.
          Directory referrals appear below automatically and need no token.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input-field flex-1"
            placeholder="Paste referral link or token…"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            aria-label="Referral link or token"
            title="Referral link or token"
          />
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={isAccepting || !tokenInput.trim()}
            className="btn-primary px-5 py-2 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
          >
            {isAccepting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isAccepting ? 'Accepting…' : 'Accept referral'}
          </button>
        </div>
        {acceptError && <p className="text-sm text-rose-600">{acceptError}</p>}
        {acceptMessage && <p className="text-sm text-emerald-700">{acceptMessage}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('inbound')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2 ${
            tab === 'inbound'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-slate-500'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Received ({inbound.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('outbound')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px flex items-center gap-2 ${
            tab === 'outbound'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-slate-500'
          }`}
        >
          <Send className="w-4 h-4" />
          Sent ({outbound.length})
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading referrals…</p>
      ) : tab === 'inbound' ? (
        inbound.length === 0 ? (
          <p className="text-sm text-slate-500">
            No referrals have been delivered to this workspace yet.
          </p>
        ) : (
          <div className="space-y-4">
            {inbound.map((r) => renderReferralCard(r, 'inbound'))}
          </div>
        )
      ) : outbound.length === 0 ? (
        <p className="text-sm text-slate-500">
          You haven&apos;t sent any referrals from this workspace yet.
        </p>
      ) : (
        <div className="space-y-4">
          {outbound.map((r) => renderReferralCard(r, 'outbound'))}
        </div>
      )}
    </div>
  );
};

export default ReferralInbox;
