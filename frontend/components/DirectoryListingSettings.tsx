'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Network } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { canListInSpecialistDirectory } from '@/lib/specialistDirectory';

interface DirectoryListingSettingsProps {
  compact?: boolean;
  onOpenSettings?: () => void;
}

export default function DirectoryListingSettings({
  compact = false,
  onOpenSettings,
}: DirectoryListingSettingsProps) {
  const auth = useAuth();
  const profile = auth.profile;
  const [listed, setListed] = useState(Boolean(profile?.directoryListed));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListed(Boolean(profile?.directoryListed));
  }, [profile?.directoryListed]);

  if (!profile || !canListInSpecialistDirectory(profile.practitionerRole)) return null;

  if (compact && profile.directoryListed) return null;

  const save = async (next: boolean) => {
    setSaving(true);
    setMessage(null);
    setError(null);
    const result = await auth.setDirectoryListing(next);
    setSaving(false);
    if (result.error) {
      setListed(Boolean(profile.directoryListed));
      setError(result.error);
      return;
    }
    setListed(next);
    setMessage(next ? 'Direct referrals are now enabled.' : 'Directory listing switched off.');
  };

  if (compact) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <Network className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Receive referrals automatically</p>
            <p className="text-sm text-slate-600 mt-1">
              Your specialist account is not listed yet. Turn on direct referrals in Settings so
              GPs can send cases straight to this workspace without copying a link.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="btn-primary px-5 py-2.5 text-sm shrink-0"
        >
          Open referral settings
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-indigo-600 font-semibold">
          Specialist referrals
        </p>
        <h3 className="text-lg font-semibold text-slate-900 mt-1">Direct referral directory</h3>
        <p className="text-sm text-slate-600 mt-2">
          When enabled, GPs can find your name, role, speciality, and practice and deliver a
          patient case directly to this workspace. Email, phone, and BHF details are never listed.
        </p>
      </div>

      <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 cursor-pointer">
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            Accept direct referrals through SaluLink
          </span>
          <span className="block text-xs text-slate-500 mt-1">
            You can switch this off at any time. Existing referrals remain available.
          </span>
        </span>
        <input
          type="checkbox"
          checked={listed}
          disabled={saving}
          onChange={(event) => {
            const next = event.target.checked;
            setListed(next);
            void save(next);
          }}
          className="mt-1 h-5 w-5"
          aria-label="Accept direct referrals through SaluLink"
        />
      </label>

      {saving && (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Saving…
        </p>
      )}
      {message && !saving && (
        <p className="text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {message}
        </p>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </section>
  );
}
