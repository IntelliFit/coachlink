import supabase from "@/lib/supabaseClient";
import {
  shouldCountExecutionBeforeSubscriptionStart,
  shouldCountPlanInstanceForSubscriptionEntitlement,
} from "@/lib/subscriptionEntitlement";

type CarryoverInstanceLike = {
  id?: string | null;
  start_execution_day?: number | null;
  created_at?: string | null;
  status?: string | null;
  entitlement_consumption_policy?: string | null;
};

type CarryoverExecutionLike = {
  instance_id?: string | null;
  day_index?: number | null;
  status?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

export type SubscriptionCarryoverSummary = {
  purchasedWeeks: number;
  progressedDayIndex: number;
  progressedWeeks: number;
  remainingWeeks: number;
  sourceInstanceId: string | null;
  exhausted: boolean;
};

export type SubscriptionCarryoverLookup = {
  subscriptionId: string;
  subscribedWeeks?: number | null;
  excludeInstanceId?: string | null;
  createdBefore?: string | null;
  subscriptionStartDate?: string | null;
};

const CARRYOVER_INSTANCE_STATUSES = new Set([
  "active",
  "paused",
  "completed",
  "scheduled",
  "archived",
]);

function parseFiniteTime(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function deriveSubscriptionCarryoverSummaryFromHistory(params: {
  subscribedWeeks?: number | null;
  instances?: CarryoverInstanceLike[] | null;
  executions?: CarryoverExecutionLike[] | null;
  excludeInstanceId?: string | null;
  createdBefore?: string | null;
  subscriptionStartDate?: string | null;
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

  const createdBeforeTime = parseFiniteTime(params.createdBefore);
  const subscriptionStartTime = parseFiniteTime(params.subscriptionStartDate);

  const instances = (params.instances || [])
    .filter((instance) => {
      const instanceId = String(instance?.id || "").trim();
      if (!instanceId) return false;
      if (params.excludeInstanceId && instanceId === params.excludeInstanceId) {
        return false;
      }

      const status = String(instance?.status || "").trim().toLowerCase();
      if (status && !CARRYOVER_INSTANCE_STATUSES.has(status)) {
        return false;
      }

      if (createdBeforeTime !== null) {
        const createdAtTime = parseFiniteTime(instance?.created_at);
        if (createdAtTime === null || createdAtTime >= createdBeforeTime) {
          return false;
        }
      }

      return shouldCountPlanInstanceForSubscriptionEntitlement(instance);
    })
    .sort((a, b) => {
      const aTime = parseFiniteTime(a.created_at) ?? 0;
      const bTime = parseFiniteTime(b.created_at) ?? 0;
      return aTime - bTime;
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

  const instanceById = new Map<string, CarryoverInstanceLike>();
  for (const instance of instances) {
    const instanceId = String(instance?.id || "").trim();
    if (instanceId) {
      instanceById.set(instanceId, instance);
    }
  }

  const completedWeekRangeByInstance = new Map<
    string,
    { minWeek: number; maxWeek: number }
  >();

  for (const execution of params.executions || []) {
    if (execution?.status && execution.status !== "completed") continue;

    const instanceId = String(execution?.instance_id || "").trim();
    if (!instanceId) continue;

    const instance = instanceById.get(instanceId);
    if (!instance) continue;

    const dayIndex = Number(execution?.day_index || 0);
    if (!Number.isFinite(dayIndex) || dayIndex <= 0) continue;

    if (
      subscriptionStartTime !== null &&
      !shouldCountExecutionBeforeSubscriptionStart(instance)
    ) {
      const occurredAtTime = parseFiniteTime(
        execution.completed_at || execution.started_at || execution.created_at,
      );
      if (occurredAtTime !== null && occurredAtTime < subscriptionStartTime) {
        continue;
      }
    }

    const weekIndex = Math.ceil(dayIndex / 7);
    const current = completedWeekRangeByInstance.get(instanceId);
    if (!current) {
      completedWeekRangeByInstance.set(instanceId, {
        minWeek: weekIndex,
        maxWeek: weekIndex,
      });
      continue;
    }

    current.minWeek = Math.min(current.minWeek, weekIndex);
    current.maxWeek = Math.max(current.maxWeek, weekIndex);
  }

  let consumedWeeks = 0;
  let sourceInstanceId: string | null = null;

  for (const instance of instances) {
    const instanceId = String(instance?.id || "").trim();
    if (!instanceId) continue;

    const startExecutionDay = Math.max(
      1,
      Number(instance?.start_execution_day || 1),
    );
    const carriedWeeks = Math.ceil(Math.max(0, startExecutionDay - 1) / 7);

    const completedWeekRange = completedWeekRangeByInstance.get(instanceId);
    const completedWeeks = completedWeekRange
      ? Math.max(
        0,
        completedWeekRange.maxWeek - completedWeekRange.minWeek + 1,
      )
      : 0;

    const instanceConsumedWeeks = Math.max(carriedWeeks, completedWeeks);
    if (instanceConsumedWeeks > 0) {
      consumedWeeks += instanceConsumedWeeks;
      sourceInstanceId = instanceId;
    }
  }

  const progressedWeeks = Math.min(purchasedWeeks, consumedWeeks);
  const remainingWeeks = Math.max(0, purchasedWeeks - progressedWeeks);

  return {
    purchasedWeeks,
    progressedDayIndex: progressedWeeks * 7,
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
  subscriptionStartDate?: string | null;
}): Promise<SubscriptionCarryoverSummary> {
  const summaries = await getSubscriptionCarryoverSummariesBatch([params]);
  return summaries.get(params.subscriptionId) || createEmptyCarryoverSummary(params.subscribedWeeks);
}

function createEmptyCarryoverSummary(
  subscribedWeeks?: number | null,
): SubscriptionCarryoverSummary {
  const purchasedWeeks = Math.max(0, Number(subscribedWeeks || 0));
  return {
    purchasedWeeks,
    progressedDayIndex: 0,
    progressedWeeks: 0,
    remainingWeeks: purchasedWeeks,
    sourceInstanceId: null,
    exhausted: purchasedWeeks <= 0,
  };
}

/**
 * Resolve carryover for a page of subscriptions with two database round trips.
 * The entitlement calculation remains single-source in
 * deriveSubscriptionCarryoverSummaryFromHistory; only data loading is batched.
 */
export async function getSubscriptionCarryoverSummariesBatch(
  lookups: SubscriptionCarryoverLookup[],
): Promise<Map<string, SubscriptionCarryoverSummary>> {
  const summaries = new Map<string, SubscriptionCarryoverSummary>();
  const validLookups: SubscriptionCarryoverLookup[] = [];

  for (const lookup of lookups || []) {
    const subscriptionId = String(lookup?.subscriptionId || "").trim();
    if (!subscriptionId) continue;

    const emptySummary = createEmptyCarryoverSummary(lookup.subscribedWeeks);
    summaries.set(subscriptionId, emptySummary);
    if (emptySummary.purchasedWeeks > 0) {
      validLookups.push({ ...lookup, subscriptionId });
    }
  }

  const subscriptionIds = Array.from(
    new Set(validLookups.map((lookup) => lookup.subscriptionId)),
  );
  if (subscriptionIds.length === 0) return summaries;

  const { data: instances, error: instancesError } = await supabase
    .from("coach_plan_instances")
    .select(
      "id, coach_subscription_id, start_execution_day, created_at, status, entitlement_consumption_policy",
    )
    .in("coach_subscription_id", subscriptionIds)
    .in("status", Array.from(CARRYOVER_INSTANCE_STATUSES));

  if (instancesError || !instances || instances.length === 0) {
    return summaries;
  }

  const instanceIds = instances
    .map((instance) => String(instance?.id || "").trim())
    .filter(Boolean);
  const { data: executions } = instanceIds.length > 0
    ? await supabase
      .from("plan_instance_executions")
      .select("instance_id, day_index, status, started_at, completed_at, created_at")
      .in("instance_id", instanceIds)
      .eq("status", "completed")
    : { data: [] as CarryoverExecutionLike[] };

  const instancesBySubscription = new Map<string, CarryoverInstanceLike[]>();
  const subscriptionByInstance = new Map<string, string>();
  for (const instance of instances as Array<CarryoverInstanceLike & {
    coach_subscription_id?: string | null;
  }>) {
    const subscriptionId = String(instance.coach_subscription_id || "").trim();
    const instanceId = String(instance.id || "").trim();
    if (!subscriptionId || !instanceId) continue;

    const bucket = instancesBySubscription.get(subscriptionId) || [];
    bucket.push(instance);
    instancesBySubscription.set(subscriptionId, bucket);
    subscriptionByInstance.set(instanceId, subscriptionId);
  }

  const executionsBySubscription = new Map<string, CarryoverExecutionLike[]>();
  for (const execution of (executions || []) as CarryoverExecutionLike[]) {
    const subscriptionId = subscriptionByInstance.get(
      String(execution.instance_id || "").trim(),
    );
    if (!subscriptionId) continue;

    const bucket = executionsBySubscription.get(subscriptionId) || [];
    bucket.push(execution);
    executionsBySubscription.set(subscriptionId, bucket);
  }

  for (const lookup of validLookups) {
    summaries.set(
      lookup.subscriptionId,
      deriveSubscriptionCarryoverSummaryFromHistory({
        subscribedWeeks: lookup.subscribedWeeks,
        instances: instancesBySubscription.get(lookup.subscriptionId) || [],
        executions: executionsBySubscription.get(lookup.subscriptionId) || [],
        excludeInstanceId: lookup.excludeInstanceId,
        createdBefore: lookup.createdBefore,
        subscriptionStartDate: lookup.subscriptionStartDate,
      }),
    );
  }

  return summaries;
}
