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

export function countActionRefs(trainingDaysRaw: unknown, actionIds: Set<string>): number {
    const days = normalizeTrainingDays(trainingDaysRaw);
    let n = 0;
    for (const day of days) {
        const sets = Array.isArray(day?.actionSets) ? day.actionSets : [];
        for (const s of sets) {
            const id = getActionIdFromSet(s);
            if (id && actionIds.has(id)) n += 1;
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

