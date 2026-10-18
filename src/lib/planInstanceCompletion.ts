type PlanDayLike = {
    dayIndex?: number | null;
    day_index?: number | null;
    type?: string | null;
};

type ExecutionLike = {
    day_index?: number | null;
    status?: string | null;
    completed_at?: string | null;
    updated_at?: string | null;
};

type PlanInstanceLike = {
    id: string;
    status?: string | null;
    end_date?: string | null;
};

export interface PlanCompletionSummary {
    allTrainingDayIndexes: number[];
    carriedTrainingDayIndexes: number[];
    trainingDayIndexes: number[];
    completedDaySet: Set<number>;
    resolvedDaySet: Set<number>;
    overallCompletedDaySet: Set<number>;
    overallResolvedDaySet: Set<number>;
    totalTrainingDays: number;
    completedTrainingDays: number;
    resolvedTrainingDays: number;
    overallTotalTrainingDays: number;
    overallCompletedTrainingDays: number;
    overallResolvedTrainingDays: number;
    isFullyCompleted: boolean;
    isLogicallyCompleted: boolean;
    latestCompletedAt: string | null;
}

function getDayIndex(day: PlanDayLike, index: number) {
    return Number(day?.dayIndex ?? day?.day_index ?? (index + 1) ?? 0);
}

function isTrainingDay(day: PlanDayLike) {
    return String(day?.type || "").trim().toLowerCase() !== "rest";
}

export function summarizePlanCompletion(params: {
    trainingDays: PlanDayLike[] | null | undefined;
    startExecutionDay?: number | null;
    executions: ExecutionLike[] | null | undefined;
}): PlanCompletionSummary {
    const startExecutionDay = Number(params.startExecutionDay || 1);
    const allTrainingDayIndexes = (Array.isArray(params.trainingDays)
        ? params.trainingDays
        : []
    )
        .map((day, index) => ({
            dayIndex: getDayIndex(day, index),
            isTraining: isTrainingDay(day),
        }))
        .filter((item) => item.isTraining && item.dayIndex > 0)
        .map((item) => item.dayIndex);
    const carriedTrainingDayIndexes = allTrainingDayIndexes.filter(
        (dayIndex) => dayIndex < startExecutionDay,
    );
    const trainingDayIndexes = allTrainingDayIndexes.filter(
        (dayIndex) => dayIndex >= startExecutionDay,
    );

    const trainingDayIndexSet = new Set(trainingDayIndexes);
    const completedDaySet = new Set<number>();
    const resolvedDaySet = new Set<number>();
    let latestCompletedAt: string | null = null;

    for (const exec of params.executions || []) {
        const dayIndex = Number(exec?.day_index || 0);
        if (!dayIndex || !trainingDayIndexSet.has(dayIndex)) continue;

        const status = String(exec?.status || "").trim().toLowerCase();
        if (status === "completed") {
            completedDaySet.add(dayIndex);
            resolvedDaySet.add(dayIndex);
            const resolvedAt = String(
                exec?.completed_at || exec?.updated_at || "",
            ).trim();
            if (
                resolvedAt &&
                (!latestCompletedAt ||
                    new Date(resolvedAt).getTime() >=
                        new Date(latestCompletedAt).getTime())
            ) {
                latestCompletedAt = resolvedAt;
            }
        } else if (status === "abandoned") {
            resolvedDaySet.add(dayIndex);
        }
    }

    const totalTrainingDays = trainingDayIndexes.length;
    const completedTrainingDays = trainingDayIndexes.filter((dayIndex) =>
        completedDaySet.has(dayIndex)
    ).length;
    const resolvedTrainingDays = trainingDayIndexes.filter((dayIndex) =>
        resolvedDaySet.has(dayIndex)
    ).length;
    const overallCompletedDaySet = new Set<number>([
        ...carriedTrainingDayIndexes,
        ...completedDaySet,
    ]);
    const overallResolvedDaySet = new Set<number>([
        ...carriedTrainingDayIndexes,
        ...resolvedDaySet,
    ]);
    const overallTotalTrainingDays = allTrainingDayIndexes.length;
    const overallCompletedTrainingDays = allTrainingDayIndexes.filter(
        (dayIndex) => overallCompletedDaySet.has(dayIndex),
    ).length;
    const overallResolvedTrainingDays = allTrainingDayIndexes.filter(
        (dayIndex) => overallResolvedDaySet.has(dayIndex),
    ).length;

    return {
        allTrainingDayIndexes,
        carriedTrainingDayIndexes,
        trainingDayIndexes,
        completedDaySet,
        resolvedDaySet,
        overallCompletedDaySet,
        overallResolvedDaySet,
        totalTrainingDays,
        completedTrainingDays,
        resolvedTrainingDays,
        overallTotalTrainingDays,
        overallCompletedTrainingDays,
        overallResolvedTrainingDays,
        isFullyCompleted: totalTrainingDays > 0 &&
            completedTrainingDays >= totalTrainingDays,
        isLogicallyCompleted: totalTrainingDays > 0 &&
            resolvedTrainingDays >= totalTrainingDays,
        latestCompletedAt,
    };
}

/**
 * Persist the active → completed transition. The update is conditional on the
 * row still being active, so when several readers notice completion at once
 * exactly one of them owns the transition and gets `onCompleted` (used to
 * start next-phase automation).
 */
export async function persistCompletedPlanInstanceIfNeeded<T extends PlanInstanceLike>(params: {
    supabase: any;
    instance: T;
    summary: PlanCompletionSummary;
    onCompleted?: (instance: T) => void;
}): Promise<T> {
    const normalizedStatus = String(params.instance.status || "")
        .trim()
        .toLowerCase();
    if (normalizedStatus !== "active" || !params.summary.isFullyCompleted) {
        return params.instance;
    }

    const endDate = params.instance.end_date ||
        (
            params.summary.latestCompletedAt
                ? new Date(params.summary.latestCompletedAt).toISOString().slice(
                    0,
                    10,
                )
                : new Date().toISOString().slice(0, 10)
        );
    const completedView = {
        ...params.instance,
        status: "completed",
        end_date: endDate,
    };

    const { data, error } = await params.supabase
        .from("coach_plan_instances")
        .update({
            status: "completed",
            end_date: endDate,
            updated_at: new Date().toISOString(),
        })
        .eq("id", params.instance.id)
        .eq("status", "active")
        .select("*")
        .maybeSingle();

    if (error) {
        console.warn(
            "[plan-instance-completion] Failed to persist completed plan instance:",
            error,
        );
        return completedView;
    }
    if (!data) {
        // Another request already moved the row out of active; it owns the event.
        return completedView;
    }

    params.onCompleted?.(data as T);
    return data as T;
}
