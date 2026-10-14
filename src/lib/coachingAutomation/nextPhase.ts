import { createAiInstanceForSubscription } from "@/app/api/plan-lib/create-ai-instance/service";
import { sendSystemMessage } from "@/lib/chat";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import { buildArchiveEntitlementPatch } from "@/lib/subscriptionEntitlement";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { activateQueuedPackageIfReady } from '@/lib/subscriptionPackageQueue';
import { createAutomationJob, isTerminalJob, markAutomationJob } from "./jobs";
import { resolveAutomationPolicy } from "./policy";

async function hasRemainingEntitlement(subscriptionId: string) {
  const { data: sub } = await (serviceRoleSupabase as any)
    .from("coach_subscriptions")
    .select("id, status, start_date, subscribed_weeks")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) return false;
  if (String(sub.status || "").toLowerCase() !== "active") return false;

  const subscribedWeeks = Number(sub.subscribed_weeks || 0);
  if (!Number.isFinite(subscribedWeeks) || subscribedWeeks <= 0) return false;

  const carryover = await getSubscriptionCarryoverSummary({
    subscriptionId,
    subscribedWeeks,
    subscriptionStartDate: sub.start_date || null,
  });
  return carryover.remainingWeeks > 0;
}

async function archiveCompletedPreviousPhase(instanceId: string) {
  const { error } = await (serviceRoleSupabase as any)
    .from("coach_plan_instances")
    .update({
      status: "archived",
      ...buildArchiveEntitlementPatch({
        hasCompletedExecution: true,
        archiveReason: "served_phase",
        entitlementPolicy: "count_service",
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId)
    .eq("status", "completed");
  return error?.message || null;
}

export async function onPlanProgressChanged(instanceId: string, triggerSource = "plan_progress_changed") {
  const { data: instance, error } = await (serviceRoleSupabase as any)
    .from("coach_plan_instances")
    .select("id, coach_subscription_id, coach_id, student_id, status, name")
    .eq("id", instanceId)
    .maybeSingle();
  if (error || !instance?.coach_subscription_id) {
    return { success: false, reason: error?.message || "instance_not_found" };
  }

  const packageResult = await activateQueuedPackageIfReady(String(instance.coach_subscription_id));
  if (packageResult.activated) return { success: true, reason: 'package_switch_needs_coach_plan' };

  if (instance.status !== "completed") {
    return { success: false, reason: "instance_not_completed" };
  }

  const subscriptionId = String(instance.coach_subscription_id);
  const { policy, context } = await resolveAutomationPolicy(subscriptionId);
  if (!context) return { success: false, reason: "subscription_not_found" };

  const job = await createAutomationJob({
    type: "next_phase",
    triggerSource,
    idempotencyKey: `next_phase:${instance.id}`,
    subscriptionId,
    coachId: context.coachId,
    studentId: context.studentId,
    planInstanceId: instance.id,
    inputSnapshot: { policy, completedPlanId: instance.id },
  });
  const isRenewalRetryAfterInsufficientCredits =
    triggerSource === "renewal_paid" &&
    job.status === "skipped" &&
    job.output_snapshot?.reason === "insufficient_entitlement";
  if (isTerminalJob(job) && !isRenewalRetryAfterInsufficientCredits) {
    return { success: job.status !== "failed", reason: job.status, jobId: job.id };
  }

  try {
    await markAutomationJob(job.id, "running");

    if (policy.nextPhaseMode === "off") {
      await markAutomationJob(job.id, "skipped", { outputSnapshot: { reason: "next_phase_mode_off" } });
      return { success: false, reason: "next_phase_mode_off", jobId: job.id };
    }

    const hasCredits = await hasRemainingEntitlement(subscriptionId);
    if (!hasCredits) {
      if (context.coachUserId) {
        await sendSystemMessage(context.coachUserId, {
          content: "学员当前阶段已完成，但订阅额度不足。请引导学员续费后再生成下一阶段计划。",
        });
      }
      await markAutomationJob(job.id, "skipped", { outputSnapshot: { reason: "insufficient_entitlement" } });
      return { success: false, reason: "insufficient_entitlement", jobId: job.id };
    }

    const publishNow = policy.nextPhaseMode === "auto_publish_if_credits";
    const nextPlan = await createAiInstanceForSubscription({
      actorUserId: context.coachUserId || context.coachId,
      actorCoachId: context.coachId,
      subscriptionId,
      initialStatus: publishNow ? "active" : "draft",
      useLLM: true,
    });
    const archivePreviousPhaseError = publishNow
      ? await archiveCompletedPreviousPhase(instance.id)
      : null;

    if (!publishNow && context.coachUserId) {
      await sendSystemMessage(context.coachUserId, {
        content: `系统已为学员生成下一阶段计划草稿：${nextPlan.name || "未命名计划"}。请前往 [我的学员](/dashboard/students) 确认后发布。`,
      });
    }

    await markAutomationJob(job.id, publishNow ? "succeeded" : "needs_coach_review", {
      planInstanceId: nextPlan.id,
      needsCoachConfirmation: !publishNow,
      outputSnapshot: {
        nextPlanId: nextPlan.id,
        status: publishNow ? "active" : "draft",
        archivedPreviousPlanId: publishNow ? instance.id : null,
        archivePreviousPhaseError,
      },
    });
    return { success: true, jobId: job.id, planInstanceId: nextPlan.id };
  } catch (err: any) {
    await markAutomationJob(job.id, "failed", { errorMessage: err?.message || String(err) }).catch(() => undefined);
    return { success: false, reason: err?.message || "next_phase_failed", jobId: job.id };
  }
}

export async function onRenewalPaid(subscriptionId: string) {
  const { policy, context } = await resolveAutomationPolicy(subscriptionId);

  const { data: current } = await (serviceRoleSupabase as any)
    .from("coach_plan_instances")
    .select("id, status, created_at")
    .eq("coach_subscription_id", subscriptionId)
    .in("status", ["completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!current?.id) {
    const job = await createAutomationJob({
      type: "renewal_check",
      triggerSource: "renewal_paid",
      idempotencyKey: `renewal_check:${subscriptionId}:${new Date().toISOString().slice(0, 10)}`,
      subscriptionId,
      coachId: context?.coachId || null,
      studentId: context?.studentId || null,
      inputSnapshot: { policy, reason: "no_completed_phase" },
    });
    await markAutomationJob(job.id, "skipped", { outputSnapshot: { reason: "no_completed_phase" } });
    return { success: false, reason: "no_completed_phase", jobId: job.id };
  }

  return onPlanProgressChanged(current.id, "renewal_paid");
}
