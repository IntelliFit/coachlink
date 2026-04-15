import supabase from "@/lib/supabaseClient";

type CarryoverInstanceLike = {
  id?: string | null;
  start_execution_day?: number | null;
  created_at?: string | null;
};

type CarryoverExecutionLike = {
  instance_id?: string | null;
  day_index?: number | null;
  status?: string | null;
};

export type SubscriptionCarryoverSummary = {
  purchasedWeeks: number;
  progressedDayIndex: number;
  progressedWeeks: number;
  remainingWeeks: number;
  sourceInstanceId: string | null;
  exhausted: boolean;
};

export function deriveSubscriptionCarryoverSummaryFromHistory(params: {
  subscribedWeeks?: number | null;
  instances?: CarryoverInstanceLike[] | null;
  executions?: CarryoverExecutionLike[] | null;
  excludeInstanceId?: string | null;
  createdBefore?: string | null;
}): SubscriptionCarryoverSummary {
  const purchasedWeeks = Math.max(0, Number(params.subscribedWeeks || 0));
  if (purchasedWeeks <= 0) {
    return {
      purchasedWeeks,
      progressedDayIndex: 0,
      progressedWeeks: 0,
      remainingWeeks: 0,
      sourceInstanceId: null,
      exhausted: true,
    };
  }

  const createdBeforeTime = params.createdBefore
    ? new Date(params.createdBefore).getTime()
    : null;

  const instances = (params.instances || []).filter((instance) => {
    const instanceId = String(instance?.id || "").trim();
    if (!instanceId) return false;
    if (params.excludeInstanceId && instanceId === params.excludeInstanceId) {
      return false;
    }

    if (createdBeforeTime !== null) {
      const createdAtTime = instance?.created_at
        ? new Date(String(instance.created_at)).getTime()
        : Number.NaN;
      if (!Number.isFinite(createdAtTime) || createdAtTime >= createdBeforeTime) {
        return false;
      }
    }

    return true;
  });

  if (instances.length === 0) {
    return {
      purchasedWeeks,
      progressedDayIndex: 0,
      progressedWeeks: 0,
      remainingWeeks: purchasedWeeks,
      sourceInstanceId: null,
      exhausted: false,
    };
  }

  const completedDayIndexByInstance = new Map<string, number>();
  for (const execution of params.executions || []) {
    if (execution?.status && execution.status !== "completed") continue;
    const instanceId = String(execution?.instance_id || "").trim();
    if (!instanceId) continue;
    const dayIndex = Number(execution?.day_index || 0);
    if (!Number.isFinite(dayIndex) || dayIndex <= 0) continue;
    const currentMax = completedDayIndexByInstance.get(instanceId) || 0;
    if (dayIndex > currentMax) {
      completedDayIndexByInstance.set(instanceId, dayIndex);
    }
  }

  let progressedDayIndex = 0;
  let sourceInstanceId: string | null = null;

  for (const instance of instances) {
    const instanceId = String(instance?.id || "").trim();
    if (!instanceId) continue;

    const carriedDayIndex = Math.max(
      0,
      Number(instance?.start_execution_day || 1) - 1,
    );
    const completedDayIndex = completedDayIndexByInstance.get(instanceId) || 0;
    const candidateProgress = Math.max(carriedDayIndex, completedDayIndex);

    if (candidateProgress > progressedDayIndex) {
      progressedDayIndex = candidateProgress;
      sourceInstanceId = instanceId;
    }
  }

  const progressedWeeks = Math.min(
    purchasedWeeks,
    Math.ceil(progressedDayIndex / 7),
  );
  const remainingWeeks = Math.max(0, purchasedWeeks - progressedWeeks);

  return {
    purchasedWeeks,
    progressedDayIndex,
    progressedWeeks,
    remainingWeeks,
    sourceInstanceId,
    exhausted: remainingWeeks <= 0,
  };
}

export async function getSubscriptionCarryoverSummary(params: {
  subscriptionId: string;
  subscribedWeeks?: number | null;
  excludeInstanceId?: string | null;
  createdBefore?: string | null;
}): Promise<SubscriptionCarryoverSummary> {
  const purchasedWeeks = Math.max(0, Number(params.subscribedWeeks || 0));
  if (!params.subscriptionId || purchasedWeeks <= 0) {
    return {
      purchasedWeeks,
      progressedDayIndex: 0,
      progressedWeeks: 0,
      remainingWeeks: purchasedWeeks,
      sourceInstanceId: null,
      exhausted: purchasedWeeks <= 0,
    };
  }

  let query = supabase
    .from("coach_plan_instances")
    .select("id, start_execution_day, created_at")
    .eq("coach_subscription_id", params.subscriptionId)
    .order("created_at", { ascending: false });

  if (params.excludeInstanceId) {
    query = query.neq("id", params.excludeInstanceId);
  }

  if (params.createdBefore) {
    query = query.lt("created_at", params.createdBefore);
  }

  const { data: instances, error: instancesError } = await query;
  if (instancesError || !instances || instances.length === 0) {
    return {
      purchasedWeeks,
      progressedDayIndex: 0,
      progressedWeeks: 0,
      remainingWeeks: purchasedWeeks,
      sourceInstanceId: null,
      exhausted: false,
    };
  }

  const instanceIds = instances
    .map((instance) => String(instance?.id || "").trim())
    .filter(Boolean);

  const { data: executions } = instanceIds.length > 0
    ? await supabase
        .from("plan_instance_executions")
        .select("instance_id, day_index, status")
        .in("instance_id", instanceIds)
        .eq("status", "completed")
    : { data: [] as CarryoverExecutionLike[] };

  return deriveSubscriptionCarryoverSummaryFromHistory({
    subscribedWeeks: purchasedWeeks,
    instances: instances as CarryoverInstanceLike[],
    executions: executions as CarryoverExecutionLike[],
    excludeInstanceId: params.excludeInstanceId,
    createdBefore: params.createdBefore,
  });
}
