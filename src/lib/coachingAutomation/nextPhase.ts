import { createAiInstanceForSubscription } from "@/app/api/plan-lib/create-ai-instance/service";
import { sendSystemMessage } from "@/lib/chat";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import { buildArchiveEntitlementPatch } from "@/lib/subscriptionEntitlement";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { activateQueuedPackageIfReady } from '@/lib/subscriptionPackageQueue';
import { createAutomationJob, isTerminalJob, markAutomationJob } from "./jobs";
import { resolveAutomationPolicy } from "./policy";

/** Remaining paid service weeks across the whole subscription; 0 when inactive. */
async function getRemainingServiceWeeks(subscriptionId: string) {
  const { data: sub } = await (serviceRoleSupabase as any)
    .from("coach_subscriptions")
    .select("id, status, start_date, subscribed_weeks")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) return 0;
  if (String(sub.status || "").toLowerCase() !== "active") return 0;

  const subscribedWeeks = Number(sub.subscribed_weeks || 0);
  if (!Number.isFinite(subscribedWeeks) || subscribedWeeks <= 0) return 0;

  const carryover = await getSubscriptionCarryoverSummary({
    subscriptionId,
    subscribedWeeks,
    subscriptionStartDate: sub.start_date || null,
  });
  return Math.max(0, Number(carryover.remainingWeeks || 0));
}

async function getStudentDisplayName(studentId: string | null | undefined) {
  if (!studentId) return "学员";
  const { data } = await (serviceRoleSupabase as any)
    .from("user_profiles")
    .select("nickname")
    .eq("user_id", studentId)
    .maybeSingle();
  return String(data?.nickname || "").trim() || "学员";
}

function formatWeeks(weeks: number) {
  return String(Math.round(weeks * 10) / 10);
}

function buildPhaseCompletedMessage(params: {
  studentName: string;
  planName: string;
  remainingWeeks: number;
  triggerSource: string;
}) {
  const who = `学员「${params.studentName}」`;
  const phase = `计划「${params.planName || "当前阶段"}」`;
  if (params.remainingWeeks <= 0) {
    return `${who}已完成${phase}，订阅额度已用完。请引导学员续费后再安排下一阶段计划。`;
  }
  const lead = params.triggerSource === "renewal_paid"
    ? `${who}已续费，${phase}此前已完成`
    : `${who}已完成${phase}`;
  return `${lead}，订阅还剩约 ${formatWeeks(params.remainingWeeks)} 周。请前往 [我的学员](/dashboard/students) 为其安排下一阶段计划。`;
}

async function hasNewerCurrentPlan(subscriptionId: string, instanceId: string, createdAt: string | null) {
  let query = (serviceRoleSupabase as any)
    .from("coach_plan_instances")
    .select("id")
    .eq("coach_subscription_id", subscriptionId)
    .neq("id", instanceId)
    .in("status", ["active", "paused", "scheduled"]);
  if (createdAt) query = query.gt("created_at", createdAt);
  const { data, error } = await query.limit(1);
  // On a failed read keep the reminder: a duplicate is cheaper than silence.
  return !error && Array.isArray(data) && data.length > 0;
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
    .select("id, coach_subscription_id, coach_id, student_id, status, name, created_at")
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
  // The coach may already have arranged the next phase by hand (common for
  // phases finished before reminders existed); a renewal must not then ask again.
  if (await hasNewerCurrentPlan(subscriptionId, instance.id, instance.created_at)) {
    return { success: false, reason: "next_phase_already_arranged" };
  }
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

    const remainingWeeks = await getRemainingServiceWeeks(subscriptionId);
    if (remainingWeeks <= 0 || policy.nextPhaseMode !== "auto_publish_if_credits") {
      // Default mode only reminds the coach: a generated draft has no review
      // or publish entry in either client, so it would sit unseen.
      if (context.coachUserId) {
        await sendSystemMessage(context.coachUserId, {
          content: buildPhaseCompletedMessage({
            studentName: await getStudentDisplayName(context.studentId),
            planName: String(instance.name || ""),
            remainingWeeks,
            triggerSource,
          }),
        });
      }
      if (remainingWeeks <= 0) {
        await markAutomationJob(job.id, "skipped", { outputSnapshot: { reason: "insufficient_entitlement" } });
        return { success: false, reason: "insufficient_entitlement", jobId: job.id };
      }
      // The reminder itself is the whole job; the coach plans the next phase
      // with the normal tools, so there is nothing to confirm here.
      await markAutomationJob(job.id, "succeeded", {
        needsCoachConfirmation: false,
        outputSnapshot: { reason: "coach_reminded", remainingWeeks },
      });
      return { success: true, reason: "coach_reminded", jobId: job.id };
    }

    const nextPlan = await createAiInstanceForSubscription({
      actorUserId: context.coachUserId || context.coachId,
      actorCoachId: context.coachId,
      subscriptionId,
      initialStatus: "active",
      useLLM: true,
    });
    const archivePreviousPhaseError = await archiveCompletedPreviousPhase(instance.id);

    await markAutomationJob(job.id, "succeeded", {
      planInstanceId: nextPlan.id,
      needsCoachConfirmation: false,
      outputSnapshot: {
        nextPlanId: nextPlan.id,
        status: "active",
        archivedPreviousPlanId: instance.id,
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
