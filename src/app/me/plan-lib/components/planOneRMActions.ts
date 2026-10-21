import { CoachActionRow } from '@/types';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import {
    collectPlanOneRMActionIds,
    isOneRMEligibleAction,
    usesRelativeIntensity,
} from '@coachlink/core/src/actionLoadMode';

const normalizeName = (name?: string | null) => (name || '').trim().toLowerCase();

// Older imported plans may only carry actionName, so names are matched as a fallback to ids.
const collectRelativeIntensityNames = (days: FormPlanTrainingDay[]) => {
    const names = new Set<string>();
    const visit = (set: any) => {
        if (set?.type === 'one-filter' && Array.isArray(set.actions)) {
            set.actions.forEach(visit);
            return;
        }
        const name = normalizeName(set?.actionName);
        if (name && usesRelativeIntensity(set)) names.add(name);
    };
    days.forEach(day => {
        if (day.type === 'rest') return;
        (day.actionSets || []).forEach(visit);
    });
    return names;
};

/**
 * Actions in this plan that actually consume a 1RM: the server would store one
 * for them, and at least one of their sets is prescribed as RM or %1RM.
 * Core/bodyweight moves that only carry the default 强度 attr are excluded.
 */
export function selectPlanOneRMActions(days: FormPlanTrainingDay[], actions: CoachActionRow[]) {
    const usedIds = collectPlanOneRMActionIds(days);
    const usedNames = collectRelativeIntensityNames(days);
    return actions.filter(action => {
        const isUsed = usedIds.has(action.id) || usedNames.has(normalizeName(action.name));
        return isUsed && isOneRMEligibleAction(action as CoachActionRow & Record<string, any>);
    });
}
