'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const {
    pendingInvite,
    loadPendingInvite,
    signUpAssistantAccount,
    signInAccount,
    acceptInvite,
    session,
    refreshWorkspace,
    workspace,
  } = useAuth();

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) void loadPendingInvite(token);
  }, [token, loadPendingInvite]);

  useEffect(() => {
    if (pendingInvite?.email) setEmail(pendingInvite.email);
  }, [pendingInvite]);

  useEffect(() => {
    if (session && token && !workspace) {
      void acceptInvite(token).then(({ error: acceptError }) => {
        if (acceptError) setError(acceptError);
        else void refreshWorkspace();
      });
    }
  }, [session, token, workspace, acceptInvite, refreshWorkspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Missing invite token.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await signUpAssistantAccount(
          email.trim(),
          password,
          firstName.trim(),
          token
        );
        if (signUpError) setError(signUpError);
        else setMessage('Welcome! Redirecting to your workspace…');
      } else {
        const { error: signInError } = await signInAccount(email.trim(), password);
        if (signInError) {
          setError(signInError);
        } else {
          const { error: acceptError } = await acceptInvite(token);
          if (acceptError) setError(acceptError);
          else setMessage('Invite accepted. Redirecting…');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-slate-600">Invalid invite link.</p>
      </div>
    );
  }

  if (workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="authi-surface-card p-8 max-w-md w-full text-center">
          <p className="text-lg font-semibold text-slate-900">You&apos;re in {workspace.name}</p>
          <a href="/" className="authi-btn-primary inline-block mt-6 px-6 py-3 rounded-xl text-sm">
            Open workspace
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-10">
      <div className="max-w-lg mx-auto px-6">
        <div className="authi-surface-card p-10">
          <p className="text-sm font-bold uppercase tracking-[0.3em] authi-gradient-text">Workspace invite</p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">Join as assistant</h1>
          <p className="mt-3 text-slate-600">
            {pendingInvite
              ? `You've been invited to collaborate on a SaluLink workspace. Use ${pendingInvite.email}.`
              : 'Loading invite details…'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-sm font-medium text-slate-700">First name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="authi-input mt-2 px-4 py-3 w-full"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={Boolean(pendingInvite?.email)}
                className="authi-input mt-2 px-4 py-3 w-full"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="authi-input mt-2 px-4 py-3 w-full"
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="authi-btn-primary w-full rounded-2xl px-6 py-3 text-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Please wait…' : mode === 'signup' ? 'Create account & join' : 'Sign in & join'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500 text-center">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-[#38b6ff] font-semibold">
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{' '}
                <button type="button" onClick={() => setMode('signup')} className="text-[#38b6ff] font-semibold">
                  Create account
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-slate-500">Loading invite…</p>
        </div>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  );
}
