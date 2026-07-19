'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import ReferralInbox from '@/components/ReferralInbox';

function ReferralsContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const auth = useAuth();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  if (auth.authLoading || auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!auth.session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="authi-surface-card p-8 max-w-md w-full text-center space-y-4">
          <p className="text-lg font-semibold text-slate-900">Sign in to accept this referral</p>
          <p className="text-sm text-slate-500">
            Referral links only work from the specialist&apos;s own SaluLink account. Sign in or create
            your workspace, then open this link again.
          </p>
          <Link href="/" className="authi-btn-primary inline-block px-6 py-3 rounded-xl text-sm">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!auth.workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="authi-surface-card p-8 max-w-md w-full text-center space-y-4">
          <p className="text-lg font-semibold text-slate-900">Finish setting up your workspace first</p>
          <p className="text-sm text-slate-500">
            You need your own practice workspace before you can accept a referral into it.
          </p>
          <Link href="/" className="authi-btn-primary inline-block px-6 py-3 rounded-xl text-sm">
            Complete workspace setup
          </Link>
        </div>
      </div>
    );
  }

  const roleLabel: Record<string, string> = {
    neurologist: 'Neurology Practice',
    gp: 'General Practice',
    specialist: 'Specialist Practice',
  };
  const practiceTypeLabel =
    roleLabel[auth.profile?.practitionerRole ?? ''] ?? 'Medical Practice';

  // Keep a single ReferralInbox mount — toggling workspace must NOT swap the component tree,
  // otherwise workspaceReferralId state is lost on remount and the case workspace never opens.
  return (
    <div className="min-h-screen bg-white">
      {!isWorkspaceOpen && (
        <div className="py-10 px-6">
          <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">
                {practiceTypeLabel}
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 mt-1">{auth.workspace.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">Referrals</p>
            </div>
            <Link href="/" className="btn-secondary px-4 py-2 text-sm">
              Back to workspace
            </Link>
          </div>
        </div>
      )}
      <ReferralInbox
        workspaceId={auth.workspace.id}
        initialToken={token}
        onWorkspaceOpenChange={setIsWorkspaceOpen}
      />
    </div>
  );
}

export default function ReferralsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-slate-500">Loading referrals…</p>
        </div>
      }
    >
      <ReferralsContent />
    </Suspense>
  );
}
