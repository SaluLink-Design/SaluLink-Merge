'use client';

import { CheckCircle2, Circle, ClipboardList, Play } from 'lucide-react';
import type { CareAction } from '@/types';
import type { ActionTemplate } from '@/lib/cibRegistrationRules';
import {
  findActionForRequirement,
  getActionStatusLabel,
  isRequirementSatisfied,
  type RegistrationProgress,
  type WorkflowContext,
} from '@/lib/careActions';
import RegistrationProgressBar from '@/components/RegistrationProgressBar';

interface CibApplicationOverviewProps {
  condition: string;
  pathwayLabel?: string;
  progress: RegistrationProgress;
  templates: ActionTemplate[];
  actions: CareAction[];
  workflowContext: WorkflowContext;
  onStart: () => void;
}

const categoryForType = (type: string): string => {
  if (type === 'gp_application' || type === 'specialist_application') return 'Application';
  if (type === 'investigation' || type === 'lab_result') return 'Diagnostic evidence';
  return 'Documentation';
};

const CibApplicationOverview = ({
  condition,
  pathwayLabel,
  progress,
  templates,
  actions,
  workflowContext,
  onStart,
}: CibApplicationOverviewProps) => {
  const grouped = templates.reduce<Record<string, ActionTemplate[]>>((acc, template) => {
    const key = categoryForType(template.requirementType);
    if (!acc[key]) acc[key] = [];
    acc[key].push(template);
    return acc;
  }, {});

  const categoryOrder = ['Application', 'Diagnostic evidence', 'Documentation'];

  const getItemProgress = (requirementKey: string) =>
    progress.items.find((item) => item.requirementKey === requirementKey);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-slate-900">CIB application overview</h3>
        <p className="text-sm text-slate-500 mt-1">
          Review everything Discovery requires for <span className="font-medium text-slate-700">{condition}</span>{' '}
          before you start coordinating evidence and submission.
        </p>
      </div>

      {pathwayLabel && (
        <div className="brand-info-box border-2">
          <p className="text-sm text-violet-800">
            <span className="font-semibold">Registration pathway:</span> {pathwayLabel}
          </p>
          <p className="text-xs text-violet-700 mt-1">
            Set from your practitioner profile. Each item below will be tracked as you work through the application.
          </p>
        </div>
      )}

      {progress.total > 0 && (
        <RegistrationProgressBar
          percent={progress.percent}
          completed={progress.completed}
          total={progress.total}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5 text-slate-400" />
          <h4 className="font-semibold text-slate-900">Requirements checklist</h4>
        </div>

        <div className="space-y-5">
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">
              No requirements could be loaded for this condition. Check that{' '}
              <span className="font-medium text-slate-700">{condition}</span> is supported in the
              CIB registration rules catalogue.
            </p>
          ) : (
            categoryOrder.map((category) => {
              const items = grouped[category];
              if (!items?.length) return null;

              return (
                <div key={category}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    {category}
                  </p>
                  <ul className="space-y-2">
                    {items.map((template) => {
                      const satisfied = isRequirementSatisfied(template, actions, workflowContext);
                      const itemProgress = getItemProgress(template.requirementKey);
                      const action = findActionForRequirement(actions, template.requirementKey);
                      const statusLabel = satisfied
                        ? 'Complete'
                        : action
                          ? getActionStatusLabel(action)
                          : 'Not started';

                      return (
                        <li
                          key={template.requirementKey}
                          className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
                            satisfied
                              ? 'border-emerald-200 bg-emerald-50/50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          {satisfied ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-slate-900">{template.requirementLabel}</p>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                  satisfied
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{template.purpose}</p>
                            <p className="text-xs text-slate-600 mt-1">
                              Assigned to: {template.likelyProviders.join(', ')}
                            </p>
                            {template.gpPathway === 'referral' && (
                              <p className="text-xs text-violet-700 mt-1">
                                GP coordinates via specialist referral — not performed in practice
                              </p>
                            )}
                            {itemProgress && !satisfied && (
                              <p className="text-xs text-amber-700 mt-1">Pending for CIB registration</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onStart}
          className="btn-primary inline-flex items-center gap-2 px-8 py-3"
        >
          <Play className="w-5 h-5" />
          Start application
        </button>
      </div>
    </div>
  );
};

export default CibApplicationOverview;
