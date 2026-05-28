'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

type AuthMode = 'login' | 'signup';

export default function AuthLanding() {
  const { signInAccount, signUpDoctorAccount } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        const { error: signInError } = await signInAccount(email.trim(), password);
        if (signInError) setError(signInError);
      } else {
        const { error: signUpError } = await signUpDoctorAccount(email.trim(), password);
        if (signUpError) {
          setError(
            signUpError.toLowerCase().includes('invalid api key')
              ? 'Supabase rejected the anon key for this project. In the dashboard open Project homkufroaufrejnpnawf → Settings → API → copy a fresh anon public key (starts with eyJ), paste it into NEXT_PUBLIC_SUPABASE_ANON_KEY, and restart npm run dev. If the project is paused, restore it first.'
              : signUpError
          );
        } else {
          setMessage(
            'Account created. If email confirmation is enabled, check your inbox then sign in to complete practice setup.'
          );
          setMode('login');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-10">
      <div className="max-w-lg mx-auto px-6">
        <div className="authi-surface-card p-10">
          <p className="text-2xl font-bold tracking-tight leading-none">
            <span className="text-slate-900">Salu</span>
            <span className="brand-link-text">Link</span>
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            {mode === 'login' ? 'Sign in to your workspace' : 'Create your doctor account'}
          </h1>
          <p className="mt-3 text-slate-600">
            {mode === 'login'
              ? 'Access your practice workspace, cases, and team.'
              : 'Doctors register here. Assistants join via an invite link from their doctor.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="authi-input mt-2 px-4 py-3 w-full"
                placeholder="you@practice.co.za"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="authi-input mt-2 px-4 py-3 w-full"
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            {mode === 'signup' && (
              <div>
                <label className="text-sm font-medium text-slate-700">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="authi-input mt-2 px-4 py-3 w-full"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="authi-btn-primary w-full rounded-2xl px-6 py-3 text-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500 text-center">
            {mode === 'login' ? (
              <>
                New doctor?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-[#38b6ff] font-semibold hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[#38b6ff] font-semibold hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
