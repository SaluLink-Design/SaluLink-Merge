'use client';

import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import type { CareAction, ChronicConditionCase } from '@/types';
import CareActionCard from '@/components/CareActionCard';
import type { ActionTemplate } from '@/lib/cibRegistrationRules';
import {
  buildPathwayActionFromActivity,
  getCareActivitiesForCondition,
  TERMINAL_STATUSES,
} from '@/lib/careActions';

interface CareActivitiesPanelProps {
  profileId: string;
  condition: string;
  chronicCase: ChronicConditionCase | undefined;
  onCreateAction: (action: CareAction) => void;
  onAdvanceAction: (actionId: string) => void;
  phaseFilter?: 'pathway' | 'ongoing' | 'all';
}

function activityToTemplate(
  activity: ReturnType<typeof getCareActivitiesForCondition>[0]
): ActionTemplate {
  return {
    requirementKey: `activity:${activity.id}`,
    requirementLabel: activity.title,
    requirementType: 'investigation',
    actionTitle: activity.title,
    purpose: activity.purpose,
    likelyProviders: [activity.provider],
    defaultOwner: activity.provider.toLowerCase().includes('gp') ? 'gp' : 'external',
    code: activity.code,
    autoResolvable: false,
  };
}

const CareActivitiesPanel = ({
  profileId,
  condition,
  chronicCase,
  onCreateAction,
  onAdvanceAction,
  phaseFilter = 'all',
}: CareActivitiesPanelProps) => {
  const activities = useMemo(() => getCareActivitiesForCondition(condition), [condition]);

  const filtered = activities.filter((a) => {
    if (phaseFilter === 'all') return true;
    return a.phase === phaseFilter;
  });

  const pathwayActions =
    chronicCase?.careActions.filter((a) => a.phase === 'pathway' || a.phase === 'ongoing') ?? [];

  const getActionForActivity = (activityId: string, title: string, code?: string) =>
    pathwayActions.find(
      (a) =>
        a.requirementRef.type === `activity:${activityId}` ||
        (code && a.treatmentItemCode === code) ||
        a.title === title
    );

  const handleStartActivity = (activity: ReturnType<typeof getCareActivitiesForCondition>[0]) => {
    const existing = getActionForActivity(activity.id, activity.title, activity.code);
    if (existing) {
      onAdvanceAction(existing.id);
      return;
    }
    const action = buildPathwayActionFromActivity(activity, profileId, condition);
    onCreateAction(action);
    onAdvanceAction(action.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-[#6366f1]" />
        <h3 className="font-semibold text-slate-900">Care Activities</h3>
      </div>
      <p className="text-sm text-slate-600">
        Patient journey activities from the treatment basket — each tracked as an action with a clear next step.
      </p>

      <div className="space-y-3">
        {filtered.map((activity) => {
          const action = getActionForActivity(activity.id, activity.title, activity.code);
          const template = activityToTemplate(activity);
          const satisfied = action ? TERMINAL_STATUSES.includes(action.status) : false;

          if (!action) {
            return (
              <CareActionCard
                key={activity.id}
                template={template}
                requiredFor="Care Activity"
                satisfied={false}
                onAdvance={() => {}}
                onStart={() => handleStartActivity(activity)}
                startLabel="Start Activity"
              />
            );
          }

          return (
            <CareActionCard
              key={activity.id}
              template={template}
              action={action}
              requiredFor="Care Activity"
              satisfied={satisfied}
              onAdvance={onAdvanceAction}
            />
          );
        })}
      </div>
    </div>
  );
};

export default CareActivitiesPanel;
