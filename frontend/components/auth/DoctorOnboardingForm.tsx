'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import type { DoctorOnboardingInput } from '@/lib/workspaceTypes';
import type { PractitionerRole } from '@/types';
import { canListInSpecialistDirectory } from '@/lib/specialistDirectory';

const ROLE_OPTIONS: { value: PractitionerRole; label: string }[] = [
  { value: 'gp', label: 'General Practitioner (GP)' },
  { value: 'neurologist', label: 'Neurologist' },
  { value: 'specialist', label: 'Other Specialist' },
  { value: 'clinical_technologist', label: 'Clinical Technologist' },
  { value: 'pathologist', label: 'Pathologist / Laboratory' },
];

export default function DoctorOnboardingForm() {
  const { completeOnboarding, signOutAccount } = useAuth();
  const [form, setForm] = useState<DoctorOnboardingInput>({
    firstName: '',
    surname: '',
    bhfNumber: '',
    speciality: '',
    practitionerRole: 'gp',
    phone: '',
    practiceName: '',
    directoryListed: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof DoctorOnboardingInput, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [needsDbSetup, setNeedsDbSetup] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copySetupSql = async () => {
    try {
      const response = await fetch('/SUPABASE_WORKSPACE_SETUP.sql');
      if (!response.ok) throw new Error('Could not load setup SQL');
      const sql = await response.text();
      await navigator.clipboard.writeText(sql);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  const update = (key: keyof DoctorOnboardingInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof DoctorOnboardingInput, string>> = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required';
    if (!form.surname.trim()) next.surname = 'Surname is required';
    if (!form.practiceName.trim()) next.practiceName = 'Practice name is required';
    if (!form.phone.trim()) next.phone = 'Telephone is required';
    if (canListInSpecialistDirectory(form.practitionerRole) && !form.speciality.trim()) {
      next.speciality = 'Speciality is required for specialist accounts';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setNeedsDbSetup(false);
    setCopyStatus('idle');
    if (!validate()) return;

    setIsSubmitting(true);
    const { error } = await completeOnboarding(form);
    setIsSubmitting(false);
    if (error) {
      const missingTables =
        /relation .* does not exist/i.test(error) ||
        /could not find the table/i.test(error) ||
        (/schema cache/i.test(error) && /table/i.test(error) && !/column/i.test(error));

      setNeedsDbSetup(missingTables);
      setSubmitError(
        missingTables
          ? 'Database tables are missing. Run the workspace setup SQL in Supabase once, then try again.'
          : error.includes('practitioner_role') && error.includes('schema cache')
            ? 'Your profiles table is missing the practitioner_role column. In Supabase SQL Editor run: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS practitioner_role text NOT NULL DEFAULT \'gp\'; then reload the schema (Settings → API → Reload) and try again.'
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
              <label className="text-sm font-medium text-slate-700">Practitioner role</label>
              <select
                value={form.practitionerRole}
                onChange={(e) => {
                  const practitionerRole = e.target.value as PractitionerRole;
                  setForm((prev) => ({
                    ...prev,
                    practitionerRole,
                    directoryListed: canListInSpecialistDirectory(practitionerRole)
                      ? prev.directoryListed
                      : false,
                  }));
                }}
                className="authi-input mt-2 px-4 py-3 w-full"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Determines your CIB registration pathway automatically.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Speciality (display)</label>
              <input
                value={form.speciality}
                onChange={(e) => update('speciality', e.target.value)}
                className={`authi-input mt-2 px-4 py-3 w-full ${errors.speciality ? 'border-rose-400' : ''}`}
                placeholder="e.g. Neurology"
              />
              {errors.speciality && <p className="mt-1 text-sm text-rose-500">{errors.speciality}</p>}
            </div>
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

          {canListInSpecialistDirectory(form.practitionerRole) && (
            <label className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={form.directoryListed}
                onChange={(e) => setForm((prev) => ({ ...prev, directoryListed: e.target.checked }))}
                className="mt-0.5 w-4 h-4"
              />
              <span className="text-sm text-slate-700">
                <span className="font-medium">Accept direct referrals through SaluLink</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  GPs can find your name, role, speciality, and practice and deliver a case directly
                  to your referral inbox. Your email, phone, and BHF number stay private. You can
                  switch this off in Settings.
                </span>
              </span>
            </label>
          )}

          {submitError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p>{submitError}</p>
              {needsDbSetup && (
                <div className="mt-3 space-y-3 text-rose-700">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      <button
                        type="button"
                        onClick={() => void copySetupSql()}
                        className="font-semibold underline"
                      >
                        Copy setup SQL
                      </button>
                      {copyStatus === 'copied' && (
                        <span className="ml-2 text-emerald-700">Copied.</span>
                      )}
                      {copyStatus === 'failed' && (
                        <span className="ml-2">
                          Copy failed — open{' '}
                          <a
                            href="/SUPABASE_WORKSPACE_SETUP.sql"
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold underline"
                          >
                            SUPABASE_WORKSPACE_SETUP.sql
                          </a>{' '}
                          manually.
                        </span>
                      )}
                    </li>
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
                    <li>Paste → Run (should say Success)</li>
                    <li>Refresh this page and submit again</li>
                  </ol>
                </div>
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
