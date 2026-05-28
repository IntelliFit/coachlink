import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveSubscriptionCarryoverSummaryFromHistory } from "./subscriptionCarryover";
import {
  deriveSubscriptionEntitlementState,
  type SubscriptionEntitlementDecision,
} from "./subscriptionEntitlementModel";
import { getSubscriptionLifecycle } from "./subscriptionLifecycle";

export type SubscriptionAuditCategory =
  | "false_blocked_by_stale_end_date"
  | "active_no_plan"
  | "true_grace_or_exhausted_not_complete"
  | "should_auto_cancel"
  | "plan_completed_entitlement_remaining"
  | "healthy"
  | "inactive";

export type SubscriptionAuditRow = {
  subscriptionId: string;
  studentId: string | null;
  coachId: string | null;
  storedStatus: string | null;
  storedEndDate: string | null;
  subscribedWeeks: number;
  instanceId: string | null;
  instanceName: string | null;
  rawLifecycle: string;
  rawGraceDaysLeft: number;
  rawGraceDeadlineAt: string | null;
  model: SubscriptionEntitlementDecision;
  categories: SubscriptionAuditCategory[];
};

export type SubscriptionAuditResult = {
  nowIso: string;
  rows: SubscriptionAuditRow[];
  counts: Record<string, number>;
};

export type RepairFalseBlockedResult = {
  dryRun: boolean;
  scope: "false-blocked";
  nowIso: string;
  matchedCount: number;
  updatedCount: number;
  rows: Array<{
    subscriptionId: string;
    studentId: string | null;
    coachId: string | null;
    oldEndDate: string | null;
    newEndDate: string | null;
    remainingCredits: number;
    usedCredits: number;
    totalCredits: number;
  }>;
};

const CURRENT_INSTANCE_STATUSES = [
  "active",
  "paused",
  "completed",
  "scheduled",
  "archived",
];

function latestNonArchivedInstance(instances: any[]) {
  return instances.find(
    (instance) => String(instance?.status || "").toLowerCase() !== "archived",
  ) || null;
}

function buildCount(rows: SubscriptionAuditRow[]) {
  const counts: Record<string, number> = {
    total: rows.length,
    status_active: rows.filter((row) => row.storedStatus === "active").length,
    status_inactive: rows.filter((row) => row.storedStatus !== "active").length,
  };

  for (const row of rows) {
    for (const category of row.categories) {
      counts[category] = (counts[category] || 0) + 1;
    }
  }

  return counts;
}

export function classifySubscriptionAuditRow(params: {
  subscription: any;
  instance: any | null;
  model: SubscriptionEntitlementDecision;
  rawLifecycle: ReturnType<typeof getSubscriptionLifecycle>;
}) {
  const categories: SubscriptionAuditCategory[] = [];
  const status = String(params.subscription?.status || "");
  const active = status === "active";
  const hasPlan = !!params.instance?.id;

  if (!active) {
    categories.push("inactive");
    return categories;
  }

  if (
    hasPlan &&
    params.rawLifecycle.lifecycleStatus !== "active" &&
    params.model.lifecycleStatus === "active" &&
    params.model.remainingCredits > 0
  ) {
    categories.push("false_blocked_by_stale_end_date");
  }

  if (!hasPlan) {
    categories.push("active_no_plan");
  }

  if (
    hasPlan &&
    params.model.totalCredits > 0 &&
    params.model.remainingCredits <= 0 &&
    params.model.planProgressStatus !== "completed"
  ) {
    categories.push("true_grace_or_exhausted_not_complete");
  }

  if (params.model.shouldAutoCancel) {
    categories.push("should_auto_cancel");
  }

  if (
    hasPlan &&
    params.model.planProgressStatus === "completed" &&
    params.model.remainingCredits > 0
  ) {
    categories.push("plan_completed_entitlement_remaining");
  }

  if (categories.length === 0) {
    categories.push("healthy");
  }

  return categories;
}

export async function auditSubscriptionEntitlements(params: {
  supabase: Pick<SupabaseClient, "from">;
  now?: Date;
  subscriptionIds?: string[];
}): Promise<SubscriptionAuditResult> {
  const now = params.now || new Date();
  const nowIso = now.toISOString();

  let subscriptionQuery = params.supabase
    .from("coach_subscriptions")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.subscriptionIds?.length) {
    subscriptionQuery = subscriptionQuery.in("id", params.subscriptionIds);
  }

  const { data: subscriptions, error: subscriptionError } =
    await subscriptionQuery;

  if (subscriptionError) {
    throw new Error(`Failed to load subscriptions: ${subscriptionError.message}`);
  }

  const subscriptionIds = ((subscriptions || []) as any[])
    .map((subscription) => subscription?.id)
    .filter(Boolean);

  const { data: instances, error: instanceError } = subscriptionIds.length > 0
    ? await params.supabase
      .from("coach_plan_instances")
      .select(
        "id, coach_subscription_id, student_id, coach_id, name, status, start_date, end_date, start_execution_day, training_days, created_at, updated_at",
      )
      .in("coach_subscription_id", subscriptionIds)
      .in("status", CURRENT_INSTANCE_STATUSES)
      .order("created_at", { ascending: false })
    : { data: [] as any[], error: null };

  if (instanceError) {
    throw new Error(`Failed to load plan instances: ${instanceError.message}`);
  }

  const instanceIds = ((instances || []) as any[])
    .map((instance) => instance?.id)
    .filter(Boolean);

  const { data: executions, error: executionError } = instanceIds.length > 0
    ? await params.supabase
      .from("plan_instance_executions")
      .select(
        "id, instance_id, day_index, status, started_at, completed_at, created_at, updated_at",
      )
      .in("instance_id", instanceIds)
      .order("day_index", { ascending: true })
    : { data: [] as any[], error: null };

  if (executionError) {
    throw new Error(`Failed to load executions: ${executionError.message}`);
  }

  const instancesBySubscriptionId = new Map<string, any[]>();
  for (const instance of (instances || []) as any[]) {
    const subscriptionId = String(instance?.coach_subscription_id || "");
    if (!subscriptionId) continue;
    const list = instancesBySubscriptionId.get(subscriptionId) || [];
    list.push(instance);
    instancesBySubscriptionId.set(subscriptionId, list);
  }

  const completedExecutions = ((executions || []) as any[]).filter(
    (execution) => execution?.status === "completed",
  );
  const completedExecutionsByInstanceId = new Map<string, any[]>();
  for (const execution of completedExecutions) {
    const instanceId = String(execution?.instance_id || "");
    if (!instanceId) continue;
    const list = completedExecutionsByInstanceId.get(instanceId) || [];
    list.push(execution);
    completedExecutionsByInstanceId.set(instanceId, list);
  }

  const rows: SubscriptionAuditRow[] = ((subscriptions || []) as any[]).map(
    (subscription) => {
      const subscriptionInstances =
        instancesBySubscriptionId.get(String(subscription?.id || "")) || [];
      const instance = latestNonArchivedInstance(subscriptionInstances);
      const carryover = instance
        ? deriveSubscriptionCarryoverSummaryFromHistory({
          subscribedWeeks: Number(subscription?.subscribed_weeks || 0),
          instances: subscriptionInstances,
          executions: completedExecutions,
          excludeInstanceId: String(instance?.id || ""),
          createdBefore: instance?.created_at || null,
          subscriptionStartDate: subscription?.start_date || null,
        })
        : null;
      const model = deriveSubscriptionEntitlementState({
        subscription,
        planInstance: instance,
        executions: instance
          ? completedExecutionsByInstanceId.get(String(instance.id)) || []
          : [],
        effectiveSubscribedWeeks: carryover?.remainingWeeks,
        now,
      });
      const rawLifecycle = getSubscriptionLifecycle({
        subscription,
        now,
      });
      const categories = classifySubscriptionAuditRow({
        subscription,
        instance,
        model,
        rawLifecycle,
      });

      return {
        subscriptionId: String(subscription?.id || ""),
        studentId: subscription?.student_id || null,
        coachId: subscription?.coach_id || null,
        storedStatus: subscription?.status || null,
        storedEndDate: subscription?.end_date || null,
        subscribedWeeks: Number(subscription?.subscribed_weeks || 0),
        instanceId: instance?.id || null,
        instanceName: instance?.name || null,
        rawLifecycle: rawLifecycle.lifecycleStatus,
        rawGraceDaysLeft: rawLifecycle.graceDaysLeft,
        rawGraceDeadlineAt: rawLifecycle.graceDeadlineAt,
        model,
        categories,
      };
    },
  );

  return {
    nowIso,
    rows,
    counts: buildCount(rows),
  };
}

export async function repairFalseBlockedSubscriptionEndDates(params: {
  supabase: Pick<SupabaseClient, "from">;
  execute?: boolean;
  now?: Date;
  subscriptionIds?: string[];
}): Promise<RepairFalseBlockedResult> {
  const audit = await auditSubscriptionEntitlements({
    supabase: params.supabase,
    now: params.now,
    subscriptionIds: params.subscriptionIds,
  });
  const rows = audit.rows
    .filter((row) =>
      row.categories.includes("false_blocked_by_stale_end_date") &&
      row.model.displayEndDate !== row.storedEndDate
    )
    .map((row) => ({
      subscriptionId: row.subscriptionId,
      studentId: row.studentId,
      coachId: row.coachId,
      oldEndDate: row.storedEndDate,
      newEndDate: row.model.displayEndDate,
      remainingCredits: row.model.remainingCredits,
      usedCredits: row.model.usedCredits,
      totalCredits: row.model.totalCredits,
    }));

  let updatedCount = 0;
  if (params.execute && rows.length > 0) {
    const nowIso = audit.nowIso;
    for (const row of rows) {
      const { error } = await params.supabase
        .from("coach_subscriptions")
        .update({
          end_date: row.newEndDate,
          updated_at: nowIso,
        } as any)
        .eq("id", row.subscriptionId);
      if (error) {
        throw new Error(
          `Failed to update subscription ${row.subscriptionId}: ${error.message}`,
        );
      }
      updatedCount += 1;
    }
  }

  return {
    dryRun: !params.execute,
    scope: "false-blocked",
    nowIso: audit.nowIso,
    matchedCount: rows.length,
    updatedCount,
    rows,
  };
}
