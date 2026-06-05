import { createAiInstanceForSubscription } from "@/app/api/plan-lib/create-ai-instance/service";
import { sendSystemMessage } from "@/lib/chat";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { createAutomationJob, isTerminalJob, markAutomationJob } from "./jobs";
import { resolveAutomationPolicy } from "./policy";

export interface AutomationActionResult {
  success: boolean;
  reason?: string;
  error?: string;
  jobId?: string;
  planInstanceId?: string | null;
}

export async function onSubscriptionActivated(
  subscriptionId: string,
  triggerSource = "subscription_activated",
): Promise<AutomationActionResult> {
  const { policy, context } = await resolveAutomationPolicy(subscriptionId);
  if (!context) return { success: false, reason: "subscription_not_found" };

  const job = await createAutomationJob({
    type: "initial_plan",
    triggerSource,
    idempotencyKey: `initial_plan:${context.subscriptionId}`,
    subscriptionId: context.subscriptionId,
    coachId: context.coachId,
    studentId: context.studentId,
    inputSnapshot: { policy },
  });

  if (isTerminalJob(job)) {
    return { success: job.status !== "failed", reason: job.status, jobId: job.id, planInstanceId: job.plan_instance_id };
  }

  try {
    await markAutomationJob(job.id, "running");

    if (policy.initialPlanMode === "off") {
      await markAutomationJob(job.id, "skipped", {
        outputSnapshot: { reason: "initial_plan_mode_off" },
      });
      return { success: false, reason: "initial_plan_mode_off", jobId: job.id };
    }

    const { data: subscription, error: subError } = await (serviceRoleSupabase as any)
      .from("coach_subscriptions")
      .select("id, status, subscribe_data")
      .eq("id", context.subscriptionId)
      .single();
    if (subError || !subscription) throw new Error(subError?.message || "subscription_not_found");
    if (subscription.status !== "active") {
      await markAutomationJob(job.id, "skipped", { outputSnapshot: { reason: "subscription_not_active" } });
      return { success: false, reason: "subscription_not_active", jobId: job.id };
    }
    const subscribeData = subscription.subscribe_data;
    if (!subscribeData || (Array.isArray(subscribeData) && subscribeData.length === 0)) {
      await markAutomationJob(job.id, "skipped", { outputSnapshot: { reason: "missing_questionnaire" } });
      return { success: false, reason: "missing_questionnaire", jobId: job.id };
    }

    const { data: existing } = await (serviceRoleSupabase as any)
      .from("coach_plan_instances")
      .select("id, status")
      .eq("coach_subscription_id", context.subscriptionId)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      await markAutomationJob(job.id, "skipped", {
        planInstanceId: existing.id,
        outputSnapshot: { reason: "plan_instance_exists", existing },
      });
      return { success: false, reason: "plan_instance_exists", jobId: job.id, planInstanceId: existing.id };
    }

    const initialStatus = policy.initialPlanMode === "draft" ? "draft" : "active";
    const plan = await createAiInstanceForSubscription({
      actorUserId: context.coachUserId || context.coachId,
      actorCoachId: context.coachId,
      subscriptionId: context.subscriptionId,
      initialStatus,
      useLLM: true,
    });

    if (policy.initialPlanMode === "draft" && context.coachUserId) {
      await sendSystemMessage(context.coachUserId, {
        content: `系统已为新学员生成首个训练计划草稿：${plan.name || "未命名计划"}。请前往 [我的学员](/dashboard/students) 确认后发布。`,
      });
      await markAutomationJob(job.id, "needs_coach_review", {
        planInstanceId: plan.id,
        needsCoachConfirmation: true,
        outputSnapshot: { planId: plan.id, status: initialStatus },
      });
    } else {
      await markAutomationJob(job.id, "succeeded", {
        planInstanceId: plan.id,
        outputSnapshot: { planId: plan.id, status: initialStatus },
      });
    }

    return { success: true, jobId: job.id, planInstanceId: plan.id };
  } catch (error: any) {
    await markAutomationJob(job.id, "failed", {
      errorMessage: error?.message || String(error),
      outputSnapshot: { failedAt: new Date().toISOString() },
    }).catch(() => undefined);
    return {
      success: false,
      reason: error?.message || "initial_plan_failed",
      error: error instanceof Error ? error.message : String(error),
      jobId: job.id,
    };
  }
}
