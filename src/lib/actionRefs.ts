/**
 * Utilities for reading/updating action references inside training_days.
 *
 * Note:
 * - coach_plan_templates.training_days: jsonb[] (often returned as JS array; may be string in some edge cases)
 * - coach_plan_instances.training_days: jsonb (typically array)
 * - Action set may store action id as `action_id` or `actionId` (legacy)
 */

export type TrainingDayLike = {
    actionSets?: Array<Record<string, any>>;
    [k: string]: any;
};

export function normalizeTrainingDays(raw: unknown): TrainingDayLike[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as TrainingDayLike[];
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as TrainingDayLike[]) : [];
        } catch {
            return [];
        }
    }
    return [];
}

export function getActionIdFromSet(set: Record<string, any>): string | null {
    const v = (set as any).action_id || (set as any).actionId;
    return typeof v === "string" && v.trim() ? v : null;
}

function getActionIdsFromSet(set: Record<string, any>): string[] {
    if ((set as any)?.type === "one-filter" && Array.isArray((set as any).actions)) {
        return (set as any).actions
            .map((item: any) => getActionIdFromSet(item))
            .filter((id: string | null) => typeof id === "string" && id.trim());
    }
    const single = getActionIdFromSet(set);
    return single ? [single] : [];
}

export function countActionRefs(trainingDaysRaw: unknown, actionIds: Set<string>): number {
    const days = normalizeTrainingDays(trainingDaysRaw);
    let n = 0;
    for (const day of days) {
        const sets = Array.isArray(day?.actionSets) ? day.actionSets : [];
        for (const s of sets) {
            const ids = getActionIdsFromSet(s);
            for (const id of ids) {
                if (actionIds.has(id)) n += 1;
            }
        }
    }
    return n;
}

export function replaceActionRefs(
    trainingDaysRaw: unknown,
    replaceMap: Map<string, string>,
): { trainingDays: TrainingDayLike[]; replaced: number } {
    const days = normalizeTrainingDays(trainingDaysRaw);
    let replaced = 0;

    const updated = days.map((day) => {
        const sets = Array.isArray(day?.actionSets) ? day.actionSets : [];
        const nextSets = sets.map((s) => {
            if ((s as any)?.type === "one-filter" && Array.isArray((s as any).actions)) {
                const nextActions = (s as any).actions.map((action: any) => {
                    const current = getActionIdFromSet(action);
                    if (!current) return action;
                    const nextId = replaceMap.get(current);
                    if (!nextId || nextId === current) return action;
                    replaced += 1;
                    const out = { ...action } as any;
                    if ("action_id" in out) {
                        out.action_id = nextId;
                    } else if ("actionId" in out) {
                        out.actionId = nextId;
                    } else {
                        out.action_id = nextId;
                    }
                    return out;
                });
                return {
                    ...s,
                    actions: nextActions,
                } as any;
            }

            const current = getActionIdFromSet(s);
            if (!current) return s;
            const nextId = replaceMap.get(current);
            if (!nextId || nextId === current) return s;

            replaced += 1;
            const out = { ...s } as any;
            if ("action_id" in out) {
                out.action_id = nextId;
            } else if ("actionId" in out) {
                out.actionId = nextId;
            } else {
                out.action_id = nextId;
            }
            return out;
        });

        return {
            ...day,
            actionSets: nextSets,
        } as TrainingDayLike;
    });

    return { trainingDays: updated, replaced };
}

export function removeActionRefs(
    trainingDaysRaw: unknown,
    actionIds: Set<string>,
): { trainingDays: TrainingDayLike[]; removed: number } {
    const days = normalizeTrainingDays(trainingDaysRaw);
    let removed = 0;

    const updated = days.map((day) => {
        const sets = Array.isArray(day?.actionSets) ? day.actionSets : [];
        const nextSets = sets.reduce<Record<string, any>[]>((acc, set) => {
            if ((set as any)?.type === "one-filter" && Array.isArray((set as any).actions)) {
                const filteredActions = (set as any).actions.filter((action: any) => {
                    const id = getActionIdFromSet(action);
                    if (id && actionIds.has(id)) {
                        removed += 1;
                        return false;
                    }
                    return true;
                });
                if (filteredActions.length === 0) {
                    return acc;
                }
                acc.push({ ...(set as any), actions: filteredActions });
                return acc;
            }

            const id = getActionIdFromSet(set);
            if (id && actionIds.has(id)) {
                removed += 1;
                return acc;
            }
            acc.push(set);
            return acc;
        }, []);

        return {
            ...day,
            actionSets: nextSets,
        } as TrainingDayLike;
    });

    return { trainingDays: updated, removed };
}

