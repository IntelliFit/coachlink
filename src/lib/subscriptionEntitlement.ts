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
