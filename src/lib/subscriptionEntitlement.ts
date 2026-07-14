export const ENTITLEMENT_CONSUMPTION_POLICIES = [
  "count_service",
  "count_all_history",
  "no_charge",
] as const;

export type EntitlementConsumptionPolicy =
  (typeof ENTITLEMENT_CONSUMPTION_POLICIES)[number];

export const PLAN_ARCHIVE_REASONS = [
  "served_phase",
  "replaced_counted",
  "replaced_no_charge",
  "discarded_no_charge",
  "legacy_import",
  "student_removed",
  "system_cleanup",
  "other",
] as const;

export type PlanArchiveReason = (typeof PLAN_ARCHIVE_REASONS)[number];

const ENTITLEMENT_POLICY_SET = new Set<string>(
  ENTITLEMENT_CONSUMPTION_POLICIES,
);
const ARCHIVE_REASON_SET = new Set<string>(PLAN_ARCHIVE_REASONS);

export function normalizeEntitlementConsumptionPolicy(
  value?: string | null,
): EntitlementConsumptionPolicy {
  const normalized = String(value || "").trim().toLowerCase();
  return ENTITLEMENT_POLICY_SET.has(normalized)
    ? (normalized as EntitlementConsumptionPolicy)
    : "count_service";
}

export function normalizePlanArchiveReason(
  value?: string | null,
): PlanArchiveReason | null {
  const normalized = String(value || "").trim().toLowerCase();
  return ARCHIVE_REASON_SET.has(normalized)
    ? (normalized as PlanArchiveReason)
    : null;
}

export function shouldCountPlanInstanceForSubscriptionEntitlement(instance: {
  entitlement_consumption_policy?: string | null;
}): boolean {
  return normalizeEntitlementConsumptionPolicy(
    instance.entitlement_consumption_policy,
  ) !== "no_charge";
}

export function shouldCountExecutionBeforeSubscriptionStart(instance: {
  entitlement_consumption_policy?: string | null;
}): boolean {
  return normalizeEntitlementConsumptionPolicy(
    instance.entitlement_consumption_policy,
  ) === "count_all_history";
}

export function buildArchiveEntitlementPatch(params: {
  hasCompletedExecution: boolean;
  archiveReason?: string | null;
  entitlementPolicy?: string | null;
  entitlementNote?: string | null;
}) {
  const rawPolicy = String(params.entitlementPolicy || "")
    .trim()
    .toLowerCase();
  const hasExplicitPolicy =
    rawPolicy !== "" && ENTITLEMENT_POLICY_SET.has(rawPolicy);
  const explicitPolicy = hasExplicitPolicy
    ? (rawPolicy as EntitlementConsumptionPolicy)
    : null;

  const policy = explicitPolicy ??
    (params.hasCompletedExecution ? "count_service" : "no_charge");

  const explicitReason = normalizePlanArchiveReason(params.archiveReason);
  const reason = explicitReason ??
    (params.hasCompletedExecution ? "served_phase" : "discarded_no_charge");

  const note = typeof params.entitlementNote === "string"
    ? params.entitlementNote.trim() || null
    : null;

  return {
    archive_reason: reason,
    entitlement_consumption_policy: policy,
    entitlement_consumption_note: note,
  };
}

export async function archiveCurrentPlanInstancesForSubscription(params: {
  supabase: any;
  subscriptionId?: string | null;
  studentId?: string | null;
  excludeInstanceId?: string | null;
  nowIso?: string;
  statuses?: string[];
}) {
  const nowIso = params.nowIso || new Date().toISOString();
  const statuses = params.statuses || ["active", "paused"];

  let query = params.supabase
    .from("coach_plan_instances")
    .select("id")
    .in("status", statuses);

  if (params.subscriptionId) {
    query = query.eq("coach_subscription_id", params.subscriptionId);
  } else if (params.studentId) {
    query = query.eq("student_id", params.studentId);
  } else {
    return {
      archivedIds: [] as string[],
      countedIds: [] as string[],
      noChargeIds: [] as string[],
    };
  }

  if (params.excludeInstanceId) {
    query = query.neq("id", params.excludeInstanceId);
  }

  const { data: previousInstances, error: previousInstancesError } = await query;
  if (previousInstancesError) {
    throw new Error(`查询当前计划失败: ${previousInstancesError.message}`);
  }
  const previousInstanceIds = (previousInstances || [])
    .map((item: any) => String(item?.id || "").trim())
    .filter(Boolean);

  if (previousInstanceIds.length === 0) {
    return {
      archivedIds: [] as string[],
      countedIds: [] as string[],
      noChargeIds: [] as string[],
    };
  }

  const { data: completedRows, error: completedRowsError } = await params.supabase
    .from("plan_instance_executions")
    .select("instance_id")
    .in("instance_id", previousInstanceIds)
    .eq("status", "completed");
  if (completedRowsError) {
    throw new Error(`查询计划执行记录失败: ${completedRowsError.message}`);
  }

  const completedInstanceIds = new Set(
    (completedRows || [])
      .map((row: any) => String(row?.instance_id || "").trim())
      .filter(Boolean),
  );

  const countedIds = previousInstanceIds.filter((id: string) =>
    completedInstanceIds.has(id)
  );
  const noChargeIds = previousInstanceIds.filter((id: string) =>
    !completedInstanceIds.has(id)
  );

  const archiveIds = async (
    ids: string[],
    patch: Record<string, unknown>,
    failureLabel: string,
  ) => {
    if (ids.length === 0) return;

    let result = await params.supabase
      .from("coach_plan_instances")
      .update(patch)
      .in("id", ids);

    // Compatibility for deployments where the entitlement migration has not
    // reached the database yet. Status archiving is still mandatory; the
    // optional accounting metadata can be backfilled after the migration.
    const missingEntitlementColumn = result.error?.code === "PGRST204" &&
      /archive_reason|entitlement_consumption_/i.test(result.error?.message || "");
    if (missingEntitlementColumn) {
      result = await params.supabase
        .from("coach_plan_instances")
        .update({ status: "archived", updated_at: nowIso })
        .in("id", ids);
    }

    if (result.error) {
      throw new Error(`${failureLabel}: ${result.error.message}`);
    }
  };

  if (countedIds.length > 0) {
    await archiveIds(
      countedIds,
      {
        status: "archived",
        ...buildArchiveEntitlementPatch({
          hasCompletedExecution: true,
          archiveReason: "replaced_counted",
          entitlementPolicy: "count_service",
        }),
        updated_at: nowIso,
      },
      "归档已执行计划失败",
    );
  }

  if (noChargeIds.length > 0) {
    await archiveIds(
      noChargeIds,
      {
        status: "archived",
        ...buildArchiveEntitlementPatch({
          hasCompletedExecution: false,
          archiveReason: "discarded_no_charge",
          entitlementPolicy: "no_charge",
        }),
        updated_at: nowIso,
      },
      "归档未执行计划失败",
    );
  }

  return {
    archivedIds: previousInstanceIds,
    countedIds,
    noChargeIds,
  };
}

/**
 * Converge every current row for one coach subscription to one deterministic
 * winner. This is intentionally independent of the request that created a row:
 * concurrent requests must choose the same newest winner instead of each
 * preserving itself and archiving the other.
 *
 * The database trigger/unique index is the final authority once its migration
 * is deployed. This application-side loop keeps older deployments safe and
 * also repairs legacy duplicates encountered during a normal create request.
 */
export async function reconcileCurrentPlanInstancesForSubscription(params: {
  supabase: any;
  subscriptionId: string;
  maxAttempts?: number;
}) {
  const maxAttempts = Math.max(1, Math.min(5, params.maxAttempts || 3));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data: currentRows, error: currentRowsError } = await params.supabase
      .from("coach_plan_instances")
      .select("id, created_at, updated_at, status")
      .eq("coach_subscription_id", params.subscriptionId)
      .in("status", ["active", "paused"]);

    if (currentRowsError) {
      throw new Error(`查询当前计划失败: ${currentRowsError.message}`);
    }

    const sortedRows = [...(currentRows || [])].sort((left: any, right: any) => {
      const leftTime = new Date(left?.created_at || left?.updated_at || 0).getTime();
      const rightTime = new Date(right?.created_at || right?.updated_at || 0).getTime();
      if (leftTime !== rightTime) return rightTime - leftTime;
      return String(right?.id || "").localeCompare(String(left?.id || ""));
    });
    const winner = sortedRows[0] || null;

    if (!winner || sortedRows.length === 1) {
      return {
        currentInstanceId: winner?.id || null,
        archivedIds: [] as string[],
      };
    }

    const archiveResult = await archiveCurrentPlanInstancesForSubscription({
      supabase: params.supabase,
      subscriptionId: params.subscriptionId,
      excludeInstanceId: winner.id,
    });

    const { data: finalRows, error: finalRowsError } = await params.supabase
      .from("coach_plan_instances")
      .select("id")
      .eq("coach_subscription_id", params.subscriptionId)
      .in("status", ["active", "paused"]);
    if (finalRowsError) {
      throw new Error(`复核当前计划失败: ${finalRowsError.message}`);
    }
    if ((finalRows || []).length <= 1) {
      return {
        currentInstanceId: finalRows?.[0]?.id || winner.id,
        archivedIds: archiveResult.archivedIds,
      };
    }
  }

  throw new Error("并发创建后仍存在多份当前计划");
}
