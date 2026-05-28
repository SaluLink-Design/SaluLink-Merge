'use client';

import { Save, Download, Send, X, FileText } from 'lucide-react';

export type ClaimCompletionAction = 'save' | 'export_pdf' | 'export_zip' | 'send_patient';

interface ClaimCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientEmail?: string;
  isDoctor: boolean;
  isSubmitting?: boolean;
  emailDeliveryConfigured?: boolean;
  title?: string;
  subtitle?: string;
  onAction: (action: ClaimCompletionAction) => void;
}

export default function ClaimCompletionModal({
  isOpen,
  onClose,
  patientName,
  patientEmail,
  isDoctor,
  isSubmitting = false,
  emailDeliveryConfigured = false,
  title = 'Claim complete',
  subtitle = 'Choose what to do next with this case.',
  onAction,
}: ClaimCompletionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="w-10 h-10 rounded-xl authi-gradient flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-900">{patientName}</p>
            {patientEmail ? (
              <p className="text-sm text-slate-600 mt-1">{patientEmail}</p>
            ) : (
              <p className="text-sm text-amber-700 mt-1">No patient email on file — add one to send documents.</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onAction('save')}
            disabled={isSubmitting}
            className="w-full py-3 px-4 authi-btn-primary rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isDoctor ? 'Save to workspace' : 'Just save to workspace'}
          </button>

          {isDoctor && (
            <>
              <p className="text-xs text-center text-slate-400">or export documents</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onAction('export_pdf')}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => onAction('export_zip')}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export ZIP
                </button>
              </div>
            </>
          )}

          {isDoctor && patientEmail && (
            <div className="space-y-2">
              {!emailDeliveryConfigured && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Automated email is not set up yet. This will download the ZIP and open your email app — attach the
                  file manually. Add <span className="font-mono text-[11px]">RESEND_API_KEY</span> and{' '}
                  <span className="font-mono text-[11px]">RESEND_FROM_EMAIL</span> to{' '}
                  <span className="font-mono text-[11px]">.env.local</span>, then restart the dev server.
                </p>
              )}
              <button
                type="button"
                onClick={() => onAction('send_patient')}
                disabled={isSubmitting || !patientEmail}
                className="w-full py-3 px-4 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {emailDeliveryConfigured ? 'Email claim package to patient' : 'Download ZIP & open email app'}
              </button>
            </div>
          )}

          {!isDoctor && (
            <p className="text-xs text-slate-500 text-center">
              Assistants save cases for the doctor to review. Export and patient delivery can happen after doctor sign-off.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
