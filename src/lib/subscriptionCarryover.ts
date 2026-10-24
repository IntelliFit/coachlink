import supabase from "@/lib/supabaseClient";
import { readAllRowsByIdChunks } from "@/lib/supabaseKeysetPages";
import type { TrainingDayLike } from './subscriptionCredits';
import { computeConsumedServiceWeeks, SERVICE_WEEK_EPSILON } from './subscriptionServiceWeeks';
import {
  shouldCountExecutionBeforeSubscriptionStart,
  shouldCountPlanInstanceForSubscriptionEntitlement,
} from "@/lib/subscriptionEntitlement";

type CarryoverInstanceLike = {
  training_days?: TrainingDayLike[] | null;
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

export const CARRYOVER_INSTANCE_STATUS_LIST: readonly string[] = [
  "active",
  "paused",
  "completed",
  "scheduled",
  "archived",
];
const CARRYOVER_INSTANCE_STATUSES = new Set(CARRYOVER_INSTANCE_STATUS_LIST);

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
  const createdBeforeTime = parseFiniteTime(params.createdBefore);
  const subscriptionStartTime = parseFiniteTime(params.subscriptionStartDate);
  const instances = (params.instances || []).filter(instance => {
    const id = String(instance.id || "").trim();
    const status = String(instance.status || "").trim().toLowerCase();
    return id && id !== params.excludeInstanceId
      && (!status || CARRYOVER_INSTANCE_STATUSES.has(status))
      && shouldCountPlanInstanceForSubscriptionEntitlement(instance)
      && (createdBeforeTime === null || (parseFiniteTime(instance.created_at) ?? Infinity) < createdBeforeTime);
  }).sort((a, b) => (parseFiniteTime(a.created_at) ?? 0) - (parseFiniteTime(b.created_at) ?? 0));

  let consumedWeeks = 0;
  let sourceInstanceId: string | null = null;
  if (purchasedWeeks > 0) for (const instance of instances) {
    if (!Array.isArray(instance.training_days) || instance.training_days.length === 0) {
      throw new Error("历史计划内容缺失，无法按完成比例核对服务周");
    }
    const executions = (params.executions || []).filter(execution => {
      if (execution.instance_id !== instance.id || execution.status !== "completed") return false;
      const occurred = parseFiniteTime(execution.completed_at || execution.started_at || execution.created_at);
      return subscriptionStartTime === null || shouldCountExecutionBeforeSubscriptionStart(instance)
        || occurred === null || occurred >= subscriptionStartTime;
    }).map(execution => ({ ...execution, day_index: Number(execution.day_index || 0) }));
    const used = computeConsumedServiceWeeks({
      trainingDays: instance.training_days, executions, startExecutionDay: instance.start_execution_day,
    });
    consumedWeeks += used;
    if (used > SERVICE_WEEK_EPSILON) sourceInstanceId = instance.id || null;
  }
  const progressedWeeks = Math.min(purchasedWeeks, consumedWeeks);
  const rawRemaining = Math.max(0, purchasedWeeks - progressedWeeks);
  const remainingWeeks = rawRemaining < SERVICE_WEEK_EPSILON ? 0 : rawRemaining;
  return {
    purchasedWeeks, progressedDayIndex: progressedWeeks * 7, progressedWeeks,
    remainingWeeks, sourceInstanceId, exhausted: remainingWeeks === 0,
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

export type SubscriptionCarryoverHistory = {
  instancesBySubscription: Map<string, CarryoverInstanceLike[]>;
  executionsBySubscription: Map<string, CarryoverExecutionLike[]>;
};

function normalizeCarryoverLookups(lookups: SubscriptionCarryoverLookup[]) {
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

  return { summaries, validLookups };
}

/** Subscriptions whose history is worth loading: the ones with purchased weeks. */
export function selectCarryoverSubscriptionIds(lookups: SubscriptionCarryoverLookup[]): string[] {
  const { validLookups } = normalizeCarryoverLookups(lookups);
  return Array.from(new Set(validLookups.map((lookup) => lookup.subscriptionId)));
}

export function groupSubscriptionCarryoverHistory(
  instances: Array<CarryoverInstanceLike & { coach_subscription_id?: string | null }>,
  executions: CarryoverExecutionLike[],
): SubscriptionCarryoverHistory {
  const instancesBySubscription = new Map<string, CarryoverInstanceLike[]>();
  const subscriptionByInstance = new Map<string, string>();
  for (const instance of instances || []) {
    const subscriptionId = String(instance.coach_subscription_id || "").trim();
    const instanceId = String(instance.id || "").trim();
    if (!subscriptionId || !instanceId) continue;

    const bucket = instancesBySubscription.get(subscriptionId) || [];
    bucket.push(instance);
    instancesBySubscription.set(subscriptionId, bucket);
    subscriptionByInstance.set(instanceId, subscriptionId);
  }

  const executionsBySubscription = new Map<string, CarryoverExecutionLike[]>();
  for (const execution of executions || []) {
    const subscriptionId = subscriptionByInstance.get(
      String(execution.instance_id || "").trim(),
    );
    if (!subscriptionId) continue;

    const bucket = executionsBySubscription.get(subscriptionId) || [];
    bucket.push(execution);
    executionsBySubscription.set(subscriptionId, bucket);
  }

  return { instancesBySubscription, executionsBySubscription };
}

/**
 * Load every historical plan instance and completed execution for the given
 * subscriptions in two database round trips. The result depends only on the
 * subscription ids, so callers can start it before they know the per-lookup
 * filters (excludeInstanceId / createdBefore / subscriptionStartDate), which
 * are applied in memory by summarizeSubscriptionCarryoverBatch.
 */
export async function loadSubscriptionCarryoverHistory(
  subscriptionIds: readonly string[],
): Promise<SubscriptionCarryoverHistory> {
  const ids = Array.from(
    new Set((subscriptionIds || []).map((id) => String(id || "").trim()).filter(Boolean)),
  );
  if (ids.length === 0) return groupSubscriptionCarryoverHistory([], []);

  // Paginated: a coach's student page easily exceeds Supabase's 1000-row cap,
  // and a truncated history would silently overstate remaining entitlement.
  const { data: instances, error: instancesError } = await readAllRowsByIdChunks<any>(
    ids,
    (chunk, afterId) => {
      let query = supabase
        .from("coach_plan_instances")
        .select(
          "id, coach_subscription_id, training_days, start_execution_day, created_at, status, entitlement_consumption_policy",
        )
        .in("coach_subscription_id", chunk)
        .in("status", Array.from(CARRYOVER_INSTANCE_STATUSES));
      if (afterId) query = query.gt("id", afterId);
      return query.order("id", { ascending: true });
    },
  );

  if (instancesError) {
    throw new Error(`读取订阅历史计划失败: ${(instancesError as any)?.message || instancesError}`);
  }
  if (!instances || instances.length === 0) {
    return groupSubscriptionCarryoverHistory([], []);
  }

  const instanceIds = instances
    .map((instance) => String(instance?.id || "").trim())
    .filter(Boolean);
  const { data: executions, error: executionsError } = await readAllRowsByIdChunks<any>(
    instanceIds,
    (chunk, afterId) => {
      let query = supabase
        .from("plan_instance_executions")
        .select("id, instance_id, day_index, status, started_at, completed_at, created_at")
        .in("instance_id", chunk)
        .eq("status", "completed");
      if (afterId) query = query.gt("id", afterId);
      return query.order("id", { ascending: true });
    },
  );
  if (executionsError) {
    throw new Error(`读取订阅历史训练失败: ${(executionsError as any)?.message || executionsError}`);
  }

  return groupSubscriptionCarryoverHistory(instances, executions || []);
}

/** Pure: resolve each lookup against already-loaded history. */
export function summarizeSubscriptionCarryoverBatch(
  lookups: SubscriptionCarryoverLookup[],
  history: SubscriptionCarryoverHistory,
): Map<string, SubscriptionCarryoverSummary> {
  const { summaries, validLookups } = normalizeCarryoverLookups(lookups);

  for (const lookup of validLookups) {
    summaries.set(
      lookup.subscriptionId,
      deriveSubscriptionCarryoverSummaryFromHistory({
        subscribedWeeks: lookup.subscribedWeeks,
        instances: history.instancesBySubscription.get(lookup.subscriptionId) || [],
        executions: history.executionsBySubscription.get(lookup.subscriptionId) || [],
        excludeInstanceId: lookup.excludeInstanceId,
        createdBefore: lookup.createdBefore,
        subscriptionStartDate: lookup.subscriptionStartDate,
      }),
    );
  }

  return summaries;
}

/**
 * Resolve carryover for a page of subscriptions with two database round trips.
 * The entitlement calculation remains single-source in
 * deriveSubscriptionCarryoverSummaryFromHistory; only data loading is batched.
 */
export async function getSubscriptionCarryoverSummariesBatch(
  lookups: SubscriptionCarryoverLookup[],
): Promise<Map<string, SubscriptionCarryoverSummary>> {
  const history = await loadSubscriptionCarryoverHistory(selectCarryoverSubscriptionIds(lookups));
  return summarizeSubscriptionCarryoverBatch(lookups, history);
}
