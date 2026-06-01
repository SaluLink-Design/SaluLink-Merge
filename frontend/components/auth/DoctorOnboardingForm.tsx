'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import type { DoctorOnboardingInput } from '@/lib/workspaceTypes';

export default function DoctorOnboardingForm() {
  const { completeOnboarding, signOutAccount } = useAuth();
  const [form, setForm] = useState<DoctorOnboardingInput>({
    firstName: '',
    surname: '',
    bhfNumber: '',
    speciality: '',
    phone: '',
    practiceName: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof DoctorOnboardingInput, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: keyof DoctorOnboardingInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof DoctorOnboardingInput, string>> = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required';
    if (!form.surname.trim()) next.surname = 'Surname is required';
    if (!form.practiceName.trim()) next.practiceName = 'Practice name is required';
    if (!form.speciality.trim()) next.speciality = 'Speciality is required';
    if (!form.phone.trim()) next.phone = 'Telephone is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;

    setIsSubmitting(true);
    const { error } = await completeOnboarding(form);
    setIsSubmitting(false);
    if (error) {
      const needsDbSetup =
        error.includes('profiles') ||
        error.includes('schema cache') ||
        error.includes('workspaces');
      setSubmitError(
        needsDbSetup
          ? 'Database tables are missing. In Supabase open SQL Editor, paste and run the file SUPABASE_WORKSPACE_SETUP.sql from this project, then try again.'
          : error
      );
    }
  };

  return (
    <div className="min-h-screen bg-white py-10">
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex items-center justify-between gap-4 mb-8 authi-surface-card px-6 py-5 rounded-2xl">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] authi-gradient-text font-semibold">
              Practice setup
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-slate-900">Set up your workspace</h1>
            <p className="mt-2 text-slate-500">
              These details pre-fill CIB forms and identify your dedicated practice workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOutAccount()}
            className="authi-btn-secondary px-4 py-3 text-sm shrink-0"
          >
            Sign out
          </button>
        </div>

        <form onSubmit={handleSubmit} className="authi-surface-card rounded-[32px] p-8 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">First name(s)</label>
              <input
                value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)}
                className={`authi-input mt-2 px-4 py-3 w-full ${errors.firstName ? 'border-rose-400' : ''}`}
              />
              {errors.firstName && <p className="mt-1 text-sm text-rose-500">{errors.firstName}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Surname</label>
              <input
                value={form.surname}
                onChange={(e) => update('surname', e.target.value)}
                className={`authi-input mt-2 px-4 py-3 w-full ${errors.surname ? 'border-rose-400' : ''}`}
              />
              {errors.surname && <p className="mt-1 text-sm text-rose-500">{errors.surname}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Practice / workspace name</label>
            <input
              value={form.practiceName}
              onChange={(e) => update('practiceName', e.target.value)}
              className={`authi-input mt-2 px-4 py-3 w-full ${errors.practiceName ? 'border-rose-400' : ''}`}
              placeholder="e.g. Sandton Pulmonary Practice"
            />
            {errors.practiceName && <p className="mt-1 text-sm text-rose-500">{errors.practiceName}</p>}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">BHF practice number</label>
              <input
                value={form.bhfNumber}
                onChange={(e) => update('bhfNumber', e.target.value)}
                className="authi-input mt-2 px-4 py-3 w-full"
                placeholder="Optional for MVP"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Speciality</label>
              <input
                value={form.speciality}
                onChange={(e) => update('speciality', e.target.value)}
                className={`authi-input mt-2 px-4 py-3 w-full ${errors.speciality ? 'border-rose-400' : ''}`}
              />
              {errors.speciality && <p className="mt-1 text-sm text-rose-500">{errors.speciality}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Telephone</label>
            <input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={`authi-input mt-2 px-4 py-3 w-full ${errors.phone ? 'border-rose-400' : ''}`}
              placeholder="+27 ..."
            />
            {errors.phone && <p className="mt-1 text-sm text-rose-500">{errors.phone}</p>}
          </div>

          {submitError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p>{submitError}</p>
              {submitError.includes('SUPABASE_WORKSPACE_SETUP') && (
                <ol className="mt-3 list-decimal list-inside space-y-1 text-rose-700">
                  <li>
                    Open{' '}
                    <a
                      href="https://supabase.com/dashboard/project/homkufroaufrejnpnawf/sql/new"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline"
                    >
                      Supabase SQL Editor
                    </a>
                  </li>
                  <li>Copy all of <code className="text-xs">SUPABASE_WORKSPACE_SETUP.sql</code></li>
                  <li>Paste → Run → refresh this page and submit again</li>
                </ol>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="authi-btn-primary w-full rounded-2xl px-6 py-3 text-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Creating workspace…' : 'Create workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
