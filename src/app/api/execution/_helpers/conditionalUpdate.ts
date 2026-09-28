import { PLAN_EXECUTION_HARD_TIMEOUT_MS } from "@/lib/planExecutionLifecycle";

type ExecutionVersion = {
    id: string;
    student_id: string;
    status: string;
    updated_at: string;
};

/**
 * Compare-and-swap against the row read by this request. The existing database
 * updated_at trigger changes the version on every write. A null result is a
 * conflict, never a successful save. Includes lifecycle state and ownership so
 * a save cannot revive an execution closed while the request was in flight.
 */
export async function updateExecutionIfUnchanged(params: {
    client: any;
    execution: ExecutionVersion;
    patch: Record<string, unknown>;
    now?: Date;
}) {
    const { client, execution, patch } = params;
    if (!execution.updated_at) {
        throw new Error("Execution version missing; refusing an unconditional update");
    }
    let query = client.from("plan_instance_executions")
        .update(patch)
        .eq("id", execution.id)
        .eq("student_id", execution.student_id)
        .eq("status", execution.status)
        .eq("updated_at", execution.updated_at);
    if (execution.status === "in_progress") {
        query = query.gt("started_at", new Date(
            (params.now ?? new Date()).getTime() - PLAN_EXECUTION_HARD_TIMEOUT_MS,
        ).toISOString());
    }
    return query.select().maybeSingle();
}

export const EXECUTION_WRITE_CONFLICT = {
    success: false,
    code: "EXECUTION_WRITE_CONFLICT",
    message: "训练记录已更新或已结束，本次未覆盖新记录，请刷新后重试",
    data: null,
};
