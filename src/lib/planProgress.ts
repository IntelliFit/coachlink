import { addBeijingDays, getBeijingDayStart } from "@/lib/beijingTime";

type AnyMap = Record<string, any>;

const normalizeExecutionStatus = (execution: any) =>
    String(execution?.status || "").toLowerCase();

const parseExecutionActionExecutions = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const getExecutionResolvedDate = (execution: any): Date | null => {
    if (!execution) return null;
    const status = normalizeExecutionStatus(execution);
    const ts = status === "completed"
        ? execution?.completed_at || execution?.started_at
        : status === "abandoned"
            ? execution?.completed_at || execution?.updated_at ||
                execution?.started_at
            : null;
    return ts ? getBeijingDayStart(ts) : null;
};

const dayHasRestTasks = (
    day: any,
    execution: any,
    actionsMap: AnyMap,
) => {
    const actionSets = Array.isArray(day?.actionSets) ? day.actionSets : [];
    const planHasLightweight = actionSets.some((set: any) => {
        const actionId = set?.action_id || set?.actionId;
        const actionType = String(
            set?.itemType || actionsMap[actionId]?.type || "STRENGTH",
        ).toUpperCase();
        return actionType === "DIET" || actionType === "CARDIO" ||
            actionType === "HABIT";
    });
    if (planHasLightweight) return true;

    const actionExecutions = parseExecutionActionExecutions(
        execution?.action_executions,
    );
    return actionExecutions.some((item: any) => {
        const actionType = String(
            item?.item_type || item?.type ||
                actionsMap[item?.action_id || item?.source_action_id]?.type ||
                "STRENGTH",
        ).toUpperCase();
        return actionType === "DIET" || actionType === "CARDIO" ||
            actionType === "HABIT";
    });
};

export const deriveStrictSequentialProgressDay = (params: {
    planDays: any[];
    startExecutionDay: number;
    executionsByDayIndex: Record<number, any>;
    actionsMap?: AnyMap;
    explicitStartDate?: string | Date | null;
    today?: Date;
}) => {
    const {
        planDays,
        startExecutionDay,
        executionsByDayIndex,
        actionsMap = {},
        explicitStartDate,
        today = new Date(),
    } = params;

    const getDayIndex = (d: any) => Number(d?.dayIndex ?? d?.day_index ?? 0);
    const sortedPlanDays = [...(planDays || [])]
        .filter((d) => getDayIndex(d) >= startExecutionDay)
        .sort((a, b) => getDayIndex(a) - getDayIndex(b));

    const todayStart = getBeijingDayStart(today);
    const normalizedExplicitStartDate = explicitStartDate
        ? getBeijingDayStart(explicitStartDate)
        : null;

    let inferredStartDate: Date | null = null;
    for (const day of sortedPlanDays) {
        const di = getDayIndex(day);
        const execution = executionsByDayIndex[di];
        const resolvedDate = getExecutionResolvedDate(execution);
        if (!resolvedDate) continue;
        const candidate = addBeijingDays(resolvedDate, -(di - startExecutionDay));
        if (
            !inferredStartDate ||
            candidate.getTime() < inferredStartDate.getTime()
        ) {
            inferredStartDate = candidate;
        }
    }

    const firstDayActivationDate = normalizedExplicitStartDate
        ? addBeijingDays(
            normalizedExplicitStartDate,
            Math.max(0, startExecutionDay - 1),
        )
        : inferredStartDate || todayStart;

    const sequentialResolvedDays: number[] = [];
    const sequentialResolvedAtMap = new Map<number, Date>();

    let recommendedDayIndex = startExecutionDay;
    let foundUnresolvedDay = false;

    for (let idx = 0; idx < sortedPlanDays.length; idx += 1) {
        const day = sortedPlanDays[idx];
        const dayIndex = getDayIndex(day);
        if (!dayIndex) continue;

        const previousDay = idx > 0 ? sortedPlanDays[idx - 1] : null;
        const previousDayIndex = previousDay ? getDayIndex(previousDay) : null;
        const activationDate = previousDayIndex
            ? sequentialResolvedAtMap.get(previousDayIndex) || null
            : firstDayActivationDate;

        if (!activationDate) {
            recommendedDayIndex = previousDayIndex || dayIndex;
            foundUnresolvedDay = true;
            break;
        }

        const execution = executionsByDayIndex[dayIndex];
        const executionStatus = normalizeExecutionStatus(execution);
        const executionResolvedDate = getExecutionResolvedDate(execution);
        const isTerminalExecution = executionStatus === "completed" ||
            executionStatus === "abandoned";

        const dayType = String(day?.type || "training");
        let isResolved = false;
        let resolvedAt: Date | null = null;

        if (dayType === "training") {
            isResolved = isTerminalExecution;
            if (isResolved) {
                resolvedAt = executionResolvedDate &&
                        executionResolvedDate.getTime() >= activationDate.getTime()
                    ? executionResolvedDate
                    : activationDate;
            }
        } else {
            const hasRestTasks = dayHasRestTasks(day, execution, actionsMap);
            if (hasRestTasks) {
                isResolved = isTerminalExecution;
                if (isResolved) {
                    resolvedAt = executionResolvedDate &&
                            executionResolvedDate.getTime() >=
                                activationDate.getTime()
                        ? executionResolvedDate
                        : activationDate;
                }
            } else {
                // Rest day without tasks auto-resolves on the next day.
                isResolved = todayStart.getTime() > activationDate.getTime();
                resolvedAt = isResolved ? addBeijingDays(activationDate, 1) : null;
            }
        }

        if (!isResolved) {
            recommendedDayIndex = dayIndex;
            foundUnresolvedDay = true;
            break;
        }

        sequentialResolvedDays.push(dayIndex);
        sequentialResolvedAtMap.set(dayIndex, resolvedAt || activationDate);
    }

    if (!foundUnresolvedDay) {
        if (sortedPlanDays.length === 0) {
            recommendedDayIndex = startExecutionDay;
        } else {
            recommendedDayIndex = getDayIndex(sortedPlanDays[0]) ||
                startExecutionDay;
        }
    }

    return {
        recommendedDayIndex,
        resolvedDays: sequentialResolvedDays,
    };
};

