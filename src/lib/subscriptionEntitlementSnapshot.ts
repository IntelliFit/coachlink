import supabase from "@/lib/supabaseClient";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import { deriveSubscriptionEntitlementState } from "@/lib/subscriptionEntitlementModel";
import { pickCurrentPlanInstance } from "@/lib/subscriptionBalance";

export async function refreshSubscriptionEntitlementSnapshot(
  subscriptionId: string,
  options: { now?: Date } = {},
) {
  try {
    return await refreshSubscriptionEntitlementSnapshotChecked(subscriptionId, options);
  } catch (error) {
    // This is an auxiliary projection, often called AFTER a renewal/payment
    // has committed. Do not turn a committed purchase into a retryable failure.
    // Keep the persisted snapshot unchanged when source data is unavailable.
    console.error("[subscription-entitlement] snapshot refresh deferred", error);
    return null;
  }
}

async function refreshSubscriptionEntitlementSnapshotChecked(
  subscriptionId: string,
  options: { now?: Date } = {},
) {
  if (!subscriptionId) return null;

  const { data: subscription, error: subscriptionError } = await supabase
    .from("coach_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (subscriptionError) throw new Error(`读取订阅失败: ${subscriptionError.message}`);

  if (!subscription) return null;

  const { data: instances, error: instancesError } = await supabase
    .from("coach_plan_instances")
    .select("id, coach_subscription_id, training_days, start_execution_day, created_at, status, entitlement_consumption_policy")
    .eq("coach_subscription_id", subscriptionId)
    .in("status", ["active", "paused", "completed", "scheduled", "archived"])
    .order("created_at", { ascending: false });
  if (instancesError) throw new Error(`读取订阅计划失败: ${instancesError.message}`);

  const latestInstance = pickCurrentPlanInstance((instances || []) as any[]);

  if (!latestInstance?.id) return null;

  const instanceIds = ((instances || []) as any[])
    .map((instance) => instance?.id)
    .filter(Boolean);

  const { data: completedExecutions, error: executionsError } = instanceIds.length > 0
    ? await supabase
      .from("plan_instance_executions")
      .select("instance_id, day_index, status, completed_at, started_at, created_at, updated_at")
      .in("instance_id", instanceIds)
      .eq("status", "completed")
    : { data: [] as any[], error: null };
  if (executionsError) throw new Error(`读取订阅训练失败: ${executionsError.message}`);

  const carryover = await getSubscriptionCarryoverSummary({
    subscriptionId,
    subscribedWeeks: Number((subscription as any)?.subscribed_weeks || 0),
    excludeInstanceId: String(latestInstance.id || ""),
    createdBefore: latestInstance.created_at || null,
    subscriptionStartDate: (subscription as any)?.start_date || null,
  });

  const model = deriveSubscriptionEntitlementState({
    subscription: subscription as any,
    planInstance: latestInstance as any,
    executions: ((completedExecutions || []) as any[])
      .filter((execution) => execution?.instance_id === latestInstance.id)
      .map((execution) => ({
        day_index: Number(execution?.day_index || 0),
        status: execution?.status || null,
        completed_at: execution?.completed_at || null,
        started_at: execution?.started_at || null,
        created_at: execution?.created_at || null,
        updated_at: execution?.updated_at || null,
      })),
    effectiveSubscribedWeeks: carryover.remainingWeeks,
    now: options.now,
  });

  const subscriptionStatus = String((subscription as any)?.status || "").toLowerCase();
  const shouldPersistDerivedEndDate =
    subscriptionStatus === "active" || Boolean(model.displayEndDate);

  if (shouldPersistDerivedEndDate) {
    const { error: updateError } = await supabase
      .from("coach_subscriptions")
      .update({
        end_date: model.displayEndDate || null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", subscriptionId);
    if (updateError) throw new Error(`更新订阅快照失败: ${updateError.message}`);
  }

  return model;
}
