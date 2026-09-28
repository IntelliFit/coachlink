export type ExecutionCompletionSource = {
    status: string;
    completed_at?: string | null;
};

/** A content edit is not a new completion event, even if all items are checked. */
export function deriveAutomaticExecutionCompletion(
    execution: ExecutionCompletionSource,
    allItemsCompleted: boolean,
    nowIso: string,
) {
    const status = String(execution.status || "").toLowerCase();
    if (status !== "in_progress" && status !== "completed") {
        throw new Error("EXECUTION_NOT_EDITABLE");
    }
    const didComplete = status === "in_progress" && allItemsCompleted;
    return {
        status: didComplete ? "completed" : status,
        // Unknown legacy completion dates must stay unknown; never fabricate today.
        completed_at: didComplete ? nowIso : execution.completed_at ?? null,
        didComplete,
    };
}

export function retainItemCompletionTime(
    item: { status?: string; completed?: boolean; completed_at?: string | null },
    completed: boolean,
    nowIso: string,
) {
    if (!completed) return null;
    return item.status === "completed" || item.completed === true
        ? item.completed_at ?? null
        : nowIso;
}
