import supabase from "@/lib/supabaseClient";
import { deriveProjectedSubscriptionEndDate } from "@/lib/subscriptionEstimatedEndDate";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";

/**
 * 更新订阅的预计完成日期（B1：按训练日 credits 消耗）
 * - end_date：用于 UI 展示的“预计完成日”（estimated completion date，不是硬到期）
 */
export async function updateEstimatedEndDateForInstance(instanceId: string) {
  try {
    // 1. 获取计划实例信息
    const { data: instance } = await supabase
      .from("coach_plan_instances")
      .select("id, coach_subscription_id, training_days, start_execution_day, created_at")
      .eq("id", instanceId)
      .single();

    if (!instance?.coach_subscription_id || !instance.training_days) {
      return;
    }

    // 2. 读取订阅信息（subscribed_weeks 决定 credits 作用范围）
    const { data: subscription } = await supabase
      .from("coach_subscriptions")
      .select("id, start_date, subscribed_weeks, status")
      .eq("id", instance.coach_subscription_id)
      .maybeSingle();

    const subscribedWeeks = Number((subscription as any)?.subscribed_weeks || 0);
    if (!Number.isFinite(subscribedWeeks) || subscribedWeeks <= 0) {
      return;
    }

    const carryover = await getSubscriptionCarryoverSummary({
      subscriptionId: String(instance.coach_subscription_id || ""),
      subscribedWeeks,
      excludeInstanceId: String((instance as any)?.id || ""),
      createdBefore: (instance as any)?.created_at || null,
    });

    // 3. 获取已完成的训练天数
    const { data: completedExecutions } = await supabase
      .from("plan_instance_executions")
      .select("day_index, status")
      .eq("instance_id", instanceId)
      .eq("status", "completed");

    const endDate = deriveProjectedSubscriptionEndDate({
      startDate: (subscription as any)?.start_date || null,
      subscribedWeeks,
      effectiveSubscribedWeeks: carryover.remainingWeeks,
      trainingDays: (instance.training_days as any[]) || [],
      startExecutionDay: Number((instance as any).start_execution_day || 1),
      executions: (completedExecutions as any[]) || [],
    });

    const nextEndDate = endDate || (carryover.exhausted
      ? new Date().toISOString()
      : null);

    if (!nextEndDate) {
      return;
    }

    await supabase
      .from("coach_subscriptions")
      .update({ end_date: nextEndDate } as any)
      .eq("id", instance.coach_subscription_id);

    console.log(
      `Updated subscription ${instance.coach_subscription_id}: ` +
        `end_date: ${nextEndDate}`,
    );
  } catch (error) {
    console.error("更新预计完成日期失败:", error);
  }
}

