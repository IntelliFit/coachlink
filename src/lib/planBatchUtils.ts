import type { CoachActionRow, ItemType } from "@/types";
import type {
    CoachPlanAction,
    CoachPlanActionWithOneFilter,
    FormPlanTrainingDay,
} from "@/app/api/plan-lib/create-template/entity";

export interface BatchResult {
    days: FormPlanTrainingDay[];
    affectedSets: number;
    affectedDays: number;
}

const normalizeItemType = (type?: string | null): ItemType =>
    (type || "STRENGTH") as ItemType;

const normalizeAttrs = (attrs?: string[]) =>
    (attrs || []).slice().sort((a, b) => a.localeCompare(b));

const isSameArray = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

export const isActionFullyCompatible = (
    from?: CoachActionRow | null,
    to?: CoachActionRow | null,
) => {
    if (!from || !to) return false;
    const fromType = normalizeItemType(from.type);
    const toType = normalizeItemType(to.type);
    if (fromType !== toType) return false;
    return isSameArray(normalizeAttrs(from.attrs), normalizeAttrs(to.attrs));
};

export const getWeekDayMeta = (dayIndex: number) => {
    const week = Math.ceil(dayIndex / 7);
    const day = ((dayIndex - 1) % 7) + 1;
    return { week, day };
};

const buildDefaultParams = (itemType: ItemType) => {
    switch (itemType) {
        case "DIET":
            return {
                suggested_time: "08:00",
                custom_data: {
                    content: "",
                    calories: 0,
                },
            };
        case "CARDIO":
            return {
                custom_data: {
                    content: "",
                    duration: 30 * 60,
                    distance: 0,
                    pace: 0,
                },
            };
        case "HABIT":
            return {
                custom_data: {
                    habit_name: "",
                    target_duration: 10,
                },
            };
        case "STRENGTH":
        default:
            return {};
    }
};

export const buildActionSetForAction = (
    action: CoachActionRow,
): CoachPlanAction => {
    const itemType = normalizeItemType(action.type);
    const params = buildDefaultParams(itemType);
    const setName =
        itemType === "DIET"
            ? "Diet Item"
            : itemType === "CARDIO"
                ? "Cardio Item"
                : itemType === "HABIT"
                    ? "Habit Item"
                    : "";

    return {
        type: "no-filter",
        actionId: action.id,
        setName,
        params,
        itemType,
    } as CoachPlanAction;
};

const replaceActionInSet = (
    set: CoachPlanAction | CoachPlanActionWithOneFilter,
    fromActionId: string,
    toActionId: string,
) => {
    if (set.type === "one-filter") {
        const actions = (set.actions || []).map((action) =>
            action.actionId === fromActionId
                ? { ...action, actionId: toActionId }
                : action,
        );
        const replacedCount = (set.actions || []).filter(
            (action) => action.actionId === fromActionId,
        ).length;
        return {
            nextSet: { ...set, actions },
            replacedCount,
        };
    }

    if (set.actionId === fromActionId) {
        return {
            nextSet: { ...set, actionId: toActionId },
            replacedCount: 1,
        };
    }

    return { nextSet: set, replacedCount: 0 };
};

export const replaceActionInDays = (
    days: FormPlanTrainingDay[],
    fromActionId: string,
    toActionId: string,
): BatchResult => {
    let affectedSets = 0;
    let affectedDays = 0;

    const nextDays = days.map((day) => {
        if (!Array.isArray(day.actionSets) || day.actionSets.length === 0) {
            return day;
        }

        let dayReplaced = 0;
        const actionSets = day.actionSets.map((set) => {
            const { nextSet, replacedCount } = replaceActionInSet(
                set as CoachPlanAction,
                fromActionId,
                toActionId,
            );
            dayReplaced += replacedCount;
            return nextSet;
        });

        if (dayReplaced > 0) {
            affectedSets += dayReplaced;
            affectedDays += 1;
            return { ...day, actionSets };
        }

        return day;
    });

    return { days: nextDays, affectedSets, affectedDays };
};

const shouldRemoveSet = (
    set: CoachPlanAction | CoachPlanActionWithOneFilter,
    actionId: string,
) => {
    if (set.type === "one-filter") {
        return (set.actions || []).some(
            (action) => action.actionId === actionId,
        );
    }

    return set.actionId === actionId;
};

export const deleteActionInDays = (
    days: FormPlanTrainingDay[],
    actionId: string,
): BatchResult => {
    let affectedSets = 0;
    let affectedDays = 0;

    const nextDays = days.map((day) => {
        if (!Array.isArray(day.actionSets) || day.actionSets.length === 0) {
            return day;
        }

        const originalCount = day.actionSets.length;
        const actionSets = day.actionSets.filter(
            (set) =>
                !shouldRemoveSet(set as CoachPlanActionWithOneFilter, actionId),
        );
        const removedCount = originalCount - actionSets.length;

        if (removedCount > 0) {
            affectedSets += removedCount;
            affectedDays += 1;
            return { ...day, actionSets };
        }

        return day;
    });

    return { days: nextDays, affectedSets, affectedDays };
};

export const appendActionToDays = (
    days: FormPlanTrainingDay[],
    action: CoachActionRow,
    weekStart: number,
    weekEnd: number,
    weekdays: number[],
): BatchResult => {
    let affectedSets = 0;
    let affectedDays = 0;
    const normalizedWeekdays = new Set(weekdays);

    const nextDays = days.map((day) => {
        const { week, day: dayOfWeek } = getWeekDayMeta(day.dayIndex);
        if (week < weekStart || week > weekEnd) return day;
        if (!normalizedWeekdays.has(dayOfWeek)) return day;
        if (day.type !== "training") return day;

        const actionSets = Array.isArray(day.actionSets)
            ? [...day.actionSets]
            : [];
        actionSets.push(buildActionSetForAction(action));
        affectedSets += 1;
        affectedDays += 1;
        return { ...day, actionSets };
    });

    return { days: nextDays, affectedSets, affectedDays };
};







