'use client';

import { Activity } from 'lucide-react';
import { ProgressReview as ProgressReviewData } from '@/types';

interface ProgressReviewProps {
  value: ProgressReviewData;
  onChange: (updates: Partial<ProgressReviewData>) => void;
  condition?: string;
}

const fields: {
  key: keyof ProgressReviewData;
  label: string;
  placeholder: string;
  rows: number;
}[] = [
  {
    key: 'symptoms',
    label: 'Symptoms & clinical status',
    placeholder: 'How is the patient feeling? Have symptoms improved, worsened, or stayed the same?',
    rows: 3,
  },
  {
    key: 'medicationAdherence',
    label: 'Medication adherence & effectiveness',
    placeholder: 'Is the patient taking medication as prescribed? Is the current medication working? Any barriers?',
    rows: 3,
  },
  {
    key: 'sideEffects',
    label: 'Side effects',
    placeholder: 'Any adverse effects, tolerability issues, or new symptoms since last visit?',
    rows: 2,
  },
  {
    key: 'qualityOfLife',
    label: 'Quality of life',
    placeholder: 'Impact on daily activities, work, sleep, exercise tolerance, etc.',
    rows: 2,
  },
  {
    key: 'patientReportedConcerns',
    label: 'Patient-reported concerns',
    placeholder: 'What is the patient most worried about? Any questions they raised?',
    rows: 2,
  },
];

const ProgressReview = ({ value, onChange, condition }: ProgressReviewProps) => (
  <div className="card">
    <div className="flex items-center gap-3 mb-6">
      <div className="brand-icon">
        <Activity className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Patient Progress Review</h2>
        <p className="text-sm text-slate-500">
          {condition
            ? `Structured follow-up for ${condition} — is the condition under control?`
            : 'Capture symptoms, adherence, side effects, and quality of life before clinical decisions.'}
        </p>
      </div>
    </div>

    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-slate-700 mb-2">{field.label}</label>
          <textarea
            rows={field.rows}
            value={value[field.key]}
            onChange={(e) => onChange({ [field.key]: e.target.value })}
            placeholder={field.placeholder}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white text-slate-900 placeholder-slate-400"
          />
        </div>
      ))}
    </div>
  </div>
);

export default ProgressReview;
