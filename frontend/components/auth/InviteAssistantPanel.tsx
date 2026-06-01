'use client';

import { useState } from 'react';
import { Copy, Mail, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { buildInviteUrl, createWorkspaceInvite } from '@/lib/workspaceService';

export default function InviteAssistantPanel() {
  const { workspace, user, invites, refreshWorkspace } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!workspace || !user) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInviteLink('');
    if (!email.trim()) {
      setError('Assistant email is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const invite = await createWorkspaceInvite(workspace.id, email.trim(), user.id);
      setInviteLink(buildInviteUrl(invite.token));
      setEmail('');
      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="authi-panel-card mt-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl authi-gradient flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Invite your assistant</h3>
          <p className="text-sm text-slate-500">
            They will join this workspace as a collaborator and can create patient intake cases.
          </p>
        </div>
      </div>

      <form onSubmit={handleInvite} className="mt-5 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="assistant@practice.co.za"
            className="authi-input pl-10 pr-4 py-3 w-full"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="authi-btn-primary px-5 py-3 text-sm rounded-xl disabled:opacity-50"
        >
          {isSubmitting ? 'Creating…' : 'Create invite link'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {inviteLink && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Share this link</p>
          <div className="flex gap-2">
            <input readOnly value={inviteLink} className="authi-input flex-1 px-3 py-2 text-sm" />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="authi-btn-secondary px-3 py-2 text-sm flex items-center gap-1"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Send this link to your assistant by email or WhatsApp. It expires in 14 days.
          </p>
        </div>
      )}

      {invites.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Pending invites</p>
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="text-sm text-slate-700 flex items-center justify-between gap-3 py-2 border-b border-slate-100"
              >
                <span>{invite.email}</span>
                <span className="text-xs text-slate-400">
                  expires {new Date(invite.expiresAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
