import supabase from "@/lib/supabaseClient";
import {
  computeCreditsScope,
  computeUsedCredits,
  estimateRemainingDays,
} from "@/lib/subscriptionCredits";

/**
 * 更新订阅的预计完成日期（B1：按训练日 credits 消耗）
 * - end_date：用于 UI 展示的“预计完成日”（estimated completion date，不是硬到期）
 */
export async function updateEstimatedEndDateForInstance(instanceId: string) {
  try {
    // 1. 获取计划实例信息
    const { data: instance } = await supabase
      .from("coach_plan_instances")
      .select("coach_subscription_id, training_days, start_execution_day")
      .eq("id", instanceId)
      .single();

    if (!instance?.coach_subscription_id || !instance.training_days) {
      return;
    }

    // 2. 读取订阅信息（subscribed_weeks 决定 credits 作用范围）
    const { data: subscription } = await supabase
      .from("coach_subscriptions")
      .select("id, subscribed_weeks, status")
      .eq("id", instance.coach_subscription_id)
      .maybeSingle();

    const subscribedWeeks = Number((subscription as any)?.subscribed_weeks || 0);
    if (!Number.isFinite(subscribedWeeks) || subscribedWeeks <= 0) {
      return;
    }

    const scope = computeCreditsScope({
      trainingDays: (instance.training_days as any[]) || [],
      startExecutionDay: Number((instance as any).start_execution_day || 1),
      subscribedWeeks,
    });

    // 3. 获取已完成的训练天数
    const { data: completedExecutions } = await supabase
      .from("plan_instance_executions")
      .select("day_index, status")
      .eq("instance_id", instanceId)
      .eq("status", "completed");

    const usedCredits = computeUsedCredits({
      eligibleTrainingDayIndexSet: scope.eligibleTrainingDayIndexSet,
      executions: (completedExecutions as any[]) || [],
      startExecutionDay: Number((instance as any).start_execution_day || 1),
    });
    const totalCredits = scope.totalCredits;
    const remainingCredits = Math.max(0, totalCredits - usedCredits);

    // 4. 将 remainingCredits 映射为“预计还需要多少自然日”，按计划节奏推算
    const remainingDaysEstimate = estimateRemainingDays({
      subscribedWeeks,
      totalCredits,
      remainingCredits,
      fallbackCreditsPerWeek: 3,
    });

    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + remainingDaysEstimate);

    await supabase
      .from("coach_subscriptions")
      .update({ end_date: newEndDate.toISOString() } as any)
      .eq("id", instance.coach_subscription_id);

    console.log(
      `Updated subscription ${instance.coach_subscription_id}: ` +
        `${usedCredits}/${totalCredits} credits, ` +
        `remainingDays≈${remainingDaysEstimate}, end_date: ${newEndDate.toISOString()}`,
    );
  } catch (error) {
    console.error("更新预计完成日期失败:", error);
  }
}

