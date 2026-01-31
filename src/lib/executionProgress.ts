export type ExecutionLike = {
  status?: string | null;
  completed?: boolean | null;
  sets?: Array<{ status?: string | null }>;
};

export function computeExecutionProgress(actionExecutions: ExecutionLike[] | null | undefined): {
  totalItems: number;
  completedItems: number;
} {
  const actions = Array.isArray(actionExecutions) ? actionExecutions : [];

  let totalItems = 0;
  let completedItems = 0;

  for (const action of actions) {
    const sets = (action as any)?.sets;
    if (Array.isArray(sets)) {
      totalItems += sets.length;
      completedItems += sets.filter((s: any) => s?.status === "completed").length;
      continue;
    }

    // Non-strength item: count as 1
    totalItems += 1;
    if ((action as any)?.completed || (action as any)?.status === "completed") {
      completedItems += 1;
    }
  }

  return { totalItems, completedItems };
}

