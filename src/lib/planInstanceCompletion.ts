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
    trainingDayIndexes: number[];
    completedDaySet: Set<number>;
    resolvedDaySet: Set<number>;
    totalTrainingDays: number;
    completedTrainingDays: number;
    resolvedTrainingDays: number;
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
    const trainingDayIndexes = (Array.isArray(params.trainingDays)
        ? params.trainingDays
        : []
    )
        .map((day, index) => ({
            dayIndex: getDayIndex(day, index),
            isTraining: isTrainingDay(day),
        }))
        .filter((item) =>
            item.isTraining &&
            item.dayIndex >= startExecutionDay &&
            item.dayIndex > 0
        )
        .map((item) => item.dayIndex);

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

    return {
        trainingDayIndexes,
        completedDaySet,
        resolvedDaySet,
        totalTrainingDays,
        completedTrainingDays,
        resolvedTrainingDays,
        isFullyCompleted: totalTrainingDays > 0 &&
            completedTrainingDays >= totalTrainingDays,
        isLogicallyCompleted: totalTrainingDays > 0 &&
            resolvedTrainingDays >= totalTrainingDays,
        latestCompletedAt,
    };
}

export async function persistCompletedPlanInstanceIfNeeded(params: {
    supabase: any;
    instance: PlanInstanceLike;
    summary: PlanCompletionSummary;
}) {
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

    const { data, error } = await params.supabase
        .from("coach_plan_instances")
        .update({
            status: "completed",
            end_date: endDate,
            updated_at: new Date().toISOString(),
        })
        .eq("id", params.instance.id)
        .select("*")
        .single();

    if (error || !data) {
        console.warn(
            "[plan-instance-completion] Failed to persist completed plan instance:",
            error,
        );
        return {
            ...params.instance,
            status: "completed",
            end_date: endDate,
        };
    }

    return data as PlanInstanceLike;
}
