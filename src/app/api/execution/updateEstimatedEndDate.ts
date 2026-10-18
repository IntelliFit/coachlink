import supabase from "@/lib/supabaseClient";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import { deriveSubscriptionEntitlementState } from "@/lib/subscriptionEntitlementModel";
import { activateQueuedPackageIfReady } from '@/lib/subscriptionPackageQueue';

/**
 * 更新订阅的预计完成日期（B1：按训练日 credits 消耗）
 * - end_date：用于 UI 展示的“预计完成日”（estimated completion date，不是硬到期）
 */
export async function updateEstimatedEndDateForInstance(instanceId: string) {
  try {
    // 1. 获取计划实例信息
    const { data: instance, error: instanceError } = await supabase
      .from("coach_plan_instances")
      .select("id, coach_subscription_id, training_days, start_execution_day, created_at")
      .eq("id", instanceId)
      .single();
    if (instanceError) throw instanceError;

    if (!instance?.coach_subscription_id || !instance.training_days) {
      return;
    }

    // 2. 读取订阅信息（subscribed_weeks 决定 credits 作用范围）
    const { data: subscription, error: subscriptionError } = await supabase
      .from("coach_subscriptions")
      .select("id, start_date, end_date, subscribed_weeks, status")
      .eq("id", instance.coach_subscription_id)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    const subscribedWeeks = Number((subscription as any)?.subscribed_weeks || 0);
    if (!Number.isFinite(subscribedWeeks) || subscribedWeeks <= 0) {
      return;
    }

    const carryover = await getSubscriptionCarryoverSummary({
      subscriptionId: String(instance.coach_subscription_id || ""),
      subscribedWeeks,
      excludeInstanceId: String((instance as any)?.id || ""),
      createdBefore: (instance as any)?.created_at || null,
      subscriptionStartDate: (subscription as any)?.start_date || null,
    });

    // 3. 获取已完成的训练天数
    const { data: completedExecutions, error: executionsError } = await supabase
      .from("plan_instance_executions")
      .select("day_index, status, completed_at, started_at, updated_at, created_at")
      .eq("instance_id", instanceId)
      .eq("status", "completed");
    if (executionsError) throw executionsError;

    const model = deriveSubscriptionEntitlementState({
      subscription: subscription as any,
      planInstance: instance as any,
      executions: (completedExecutions as any[]) || [],
      effectiveSubscribedWeeks: carryover.remainingWeeks,
    });

    const nextEndDate = model.displayEndDate || (carryover.exhausted
      ? new Date().toISOString()
      : null);

    if (!nextEndDate) {
      return;
    }

    const { error: updateError } = await supabase
      .from("coach_subscriptions")
      .update({ end_date: nextEndDate } as any)
      .eq("id", instance.coach_subscription_id);
    if (updateError) throw updateError;
    await activateQueuedPackageIfReady(instance.coach_subscription_id);

    console.log(
      `Updated subscription ${instance.coach_subscription_id}: ` +
        `end_date: ${nextEndDate}`,
    );
  } catch (error) {
    console.error("更新预计完成日期失败:", error);
  }
}

