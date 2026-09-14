import { serviceRoleSupabase } from "@/lib/supabaseClient";

const db = serviceRoleSupabase as any;

export const PLAN_EXECUTION_HARD_TIMEOUT_MS = 5 * 60 * 60 * 1000;

export type PendingRevisionActivationResult = {
    activated: boolean;
    reason: "activated" | "execution_in_progress" | "no_pending_revision" | "source_not_found";
    instance?: any;
};

const getDayIndex = (day: any) =>
    Number(day?.dayIndex ?? day?.day_index ?? 0);

export function getPlanExecutionTimeoutCutoff(now = new Date()) {
    return new Date(now.getTime() - PLAN_EXECUTION_HARD_TIMEOUT_MS).toISOString();
}

export async function expireTimedOutPlanExecutions(params: {
    instanceId?: string | null;
    executionId?: string | null;
    now?: Date;
    client?: any;
} = {}) {
    const client = params.client || db;
    const now = params.now || new Date();
    let query = client
        .from("plan_instance_executions")
        .update({
            status: "timed_out",
            ended_at: now.toISOString(),
            close_reason: "hard_timeout_5h",
            updated_at: now.toISOString(),
        })
        .eq("status", "in_progress")
        .lte("started_at", getPlanExecutionTimeoutCutoff(now));

    if (params.instanceId) query = query.eq("instance_id", params.instanceId);
    if (params.executionId) query = query.eq("id", params.executionId);

    const { data, error } = await query.select("id, instance_id, student_id, day_index, status");
    if (error) {
        throw new Error(`训练超时收口失败: ${error.message}`);
    }
    return data || [];
}

export async function activatePendingPlanRevisionForSource(params: {
    sourceInstanceId: string;
    client?: any;
}): Promise<PendingRevisionActivationResult> {
    const client = params.client || db;

    const { data: source, error: sourceError } = await client
        .from("coach_plan_instances")
        .select("id, start_execution_day")
        .eq("id", params.sourceInstanceId)
        .maybeSingle();
    if (sourceError) throw new Error(`读取原计划失败: ${sourceError.message}`);
    if (!source) return { activated: false, reason: "source_not_found" };

    const { data: pending, error: pendingError } = await client
        .from("coach_plan_instances")
        .select("*")
        .eq("revision_of_instance_id", params.sourceInstanceId)
        .eq("status", "scheduled")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (pendingError) throw new Error(`读取待生效计划失败: ${pendingError.message}`);
    if (!pending) return { activated: false, reason: "no_pending_revision" };

    const { count: activeExecutionCount, error: activeExecutionError } = await client
        .from("plan_instance_executions")
        .select("id", { count: "exact", head: true })
        .eq("instance_id", params.sourceInstanceId)
        .eq("status", "in_progress");
    if (activeExecutionError) {
        throw new Error(`检查进行中训练失败: ${activeExecutionError.message}`);
    }
    if (Number(activeExecutionCount || 0) > 0) {
        return { activated: false, reason: "execution_in_progress" };
    }

    const { data: resolvedExecutions, error: resolvedError } = await client
        .from("plan_instance_executions")
        .select("day_index, status")
        .eq("instance_id", params.sourceInstanceId)
        .in("status", ["completed", "abandoned"]);
    if (resolvedError) throw new Error(`读取训练进度失败: ${resolvedError.message}`);

    const resolvedDayIndexes = new Set(
        (resolvedExecutions || [])
            .map((execution: any) => Number(execution?.day_index || 0))
            .filter((dayIndex: number) => dayIndex > 0),
    );
    const sourceStartExecutionDay = Math.max(1, Number(source.start_execution_day || 1));
    const trainingDays = Array.isArray(pending.training_days) ? pending.training_days : [];
    const firstUnresolvedTrainingDay = trainingDays
        .filter((day: any) => String(day?.type || "") === "training")
        .map(getDayIndex)
        .filter((dayIndex: number) =>
            dayIndex >= sourceStartExecutionDay && !resolvedDayIndexes.has(dayIndex)
        )
        .sort((left: number, right: number) => left - right)[0];
    const nextStartExecutionDay = Math.max(
        sourceStartExecutionDay,
        firstUnresolvedTrainingDay || sourceStartExecutionDay,
    );
    const { data: activatedRows, error: activateError } = await client.rpc(
        "activate_pending_plan_revision_atomic",
        {
            p_source_instance_id: params.sourceInstanceId,
            p_start_execution_day: nextStartExecutionDay,
        },
    );
    if (activateError) throw new Error(`激活待生效计划失败: ${activateError.message}`);
    const activated = Array.isArray(activatedRows) ? activatedRows[0] : activatedRows;
    if (!activated) return { activated: false, reason: "no_pending_revision" };

    return { activated: true, reason: "activated", instance: activated };
}

export async function expireAndActivatePendingPlanRevisions(params: {
    instanceId?: string | null;
    executionId?: string | null;
    now?: Date;
    client?: any;
} = {}) {
    const client = params.client || db;
    const expired = await expireTimedOutPlanExecutions({ ...params, client });
    const sourceInstanceIds = Array.from(new Set(
        expired.map((execution: any) => String(execution.instance_id || "")).filter(Boolean),
    ));
    const activations: PendingRevisionActivationResult[] = [];
    for (const sourceInstanceId of sourceInstanceIds) {
        activations.push(await activatePendingPlanRevisionForSource({ sourceInstanceId, client }));
    }
    return { expired, activations };
}
