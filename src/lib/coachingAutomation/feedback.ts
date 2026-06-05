import { sendSystemMessage } from "@/lib/chat";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { createAutomationJob, isTerminalJob, markAutomationJob } from "./jobs";
import { buildFeedbackAdjustmentPatch } from "./feedbackPatch";
import { resolveAutomationPolicy } from "./policy";

async function applyUpdatedTrainingDays(instanceId: string, updatedTrainingDays: any[]) {
  const { error } = await (serviceRoleSupabase as any)
    .from("coach_plan_instances")
    .update({
      training_days: updatedTrainingDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId);
  if (error) throw error;
}

export async function onExecutionFeedbackSubmitted(feedbackId: string) {
  const { data: feedback, error } = await (serviceRoleSupabase as any)
    .from("execution_feedbacks")
    .select("id, execution_id, instance_id, student_id, day_index, content, difficulty_rating, created_at")
    .eq("id", feedbackId)
    .maybeSingle();

  if (error || !feedback?.instance_id) {
    return { success: false, reason: error?.message || "feedback_not_found" };
  }

  const { data: instance, error: instanceError } = await (serviceRoleSupabase as any)
    .from("coach_plan_instances")
    .select("id, coach_id, coach_subscription_id, training_days, name")
    .eq("id", feedback.instance_id)
    .maybeSingle();

  if (instanceError || !instance) {
    return { success: false, reason: instanceError?.message || "plan_instance_not_found" };
  }

  const subscriptionId = String(instance.coach_subscription_id || "");
  if (!subscriptionId) return { success: false, reason: "missing_subscription" };

  const { policy, context } = await resolveAutomationPolicy(subscriptionId);
  if (!context) return { success: false, reason: "subscription_not_found" };

  const job = await createAutomationJob({
    type: "feedback_adjustment",
    triggerSource: "feedback_submitted",
    idempotencyKey: `feedback_adjustment:${feedback.id}`,
    subscriptionId,
    coachId: context.coachId,
    studentId: context.studentId,
    planInstanceId: instance.id,
    feedbackId: feedback.id,
    inputSnapshot: {
      policy,
      feedback: {
        id: feedback.id,
        dayIndex: feedback.day_index,
        difficultyRating: feedback.difficulty_rating,
        content: feedback.content,
      },
    },
  });

  if (isTerminalJob(job)) return { success: job.status !== "failed", reason: job.status, jobId: job.id };

  try {
    await markAutomationJob(job.id, "running");

    if (policy.feedbackAdjustmentMode === "off") {
      await markAutomationJob(job.id, "skipped", { outputSnapshot: { reason: "feedback_adjustment_mode_off" } });
      return { success: false, reason: "feedback_adjustment_mode_off", jobId: job.id };
    }

    const { data: blockedExecutions } = await (serviceRoleSupabase as any)
      .from("plan_instance_executions")
      .select("day_index, status")
      .eq("instance_id", instance.id)
      .in("status", ["completed", "in_progress", "abandoned"]);

    const patch = buildFeedbackAdjustmentPatch({
      trainingDays: Array.isArray(instance.training_days) ? instance.training_days : [],
      feedbackContent: String(feedback.content || ""),
      difficultyRating: feedback.difficulty_rating,
      feedbackDayIndex: Number(feedback.day_index || 0),
      blockedDayIndexes: ((blockedExecutions || []) as any[]).map((execution) => Number(execution?.day_index || 0)),
      policy,
    });

    const canAutoApply =
      patch.riskLevel === "low" &&
      Boolean(patch.updatedTrainingDays) &&
      (policy.feedbackAdjustmentMode === "auto_apply_low_risk" ||
        policy.feedbackAdjustmentMode === "auto_apply_safe");

    const { data: existingDraft } = await (serviceRoleSupabase as any)
      .from("coach_plan_adjustment_drafts")
      .select("*")
      .eq("feedback_id", feedback.id)
      .maybeSingle();

    let draft = existingDraft;
    if (!draft) {
      const { data: insertedDraft, error: draftError } = await (serviceRoleSupabase as any)
        .from("coach_plan_adjustment_drafts")
        .insert({
          job_id: job.id,
          feedback_id: feedback.id,
          plan_instance_id: instance.id,
          subscription_id: subscriptionId,
          coach_id: context.coachId,
          student_id: context.studentId,
          risk_level: patch.riskLevel,
          summary: patch.summary,
          proposed_patch: patch.proposedPatch,
          status: canAutoApply ? "applied" : "draft",
          requires_coach_review: !canAutoApply || patch.requiresCoachReview,
          applied_at: canAutoApply ? new Date().toISOString() : null,
        })
        .select("*")
        .single();
      if (draftError) throw draftError;
      draft = insertedDraft;
    }

    if (canAutoApply && patch.updatedTrainingDays) {
      await applyUpdatedTrainingDays(instance.id, patch.updatedTrainingDays);
      if (draft.status !== "applied") {
        await (serviceRoleSupabase as any)
          .from("coach_plan_adjustment_drafts")
          .update({
            status: "applied",
            applied_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", draft.id);
      }
      await markAutomationJob(job.id, "succeeded", {
        outputSnapshot: { draftId: draft.id, autoApplied: true, riskLevel: patch.riskLevel },
      });
    } else {
      if (context.coachUserId) {
        await sendSystemMessage(context.coachUserId, {
          content: `学员训练反馈已生成 AI 调整草稿：${patch.summary} 请前往 [自动化设置](/dashboard/automation) 查看。`,
        });
      }
      await markAutomationJob(job.id, "needs_coach_review", {
        needsCoachConfirmation: true,
        outputSnapshot: { draftId: draft.id, riskLevel: patch.riskLevel, autoApplied: false },
      });
    }

    return { success: true, jobId: job.id, draftId: draft.id };
  } catch (err: any) {
    await markAutomationJob(job.id, "failed", { errorMessage: err?.message || String(err) }).catch(() => undefined);
    return { success: false, reason: err?.message || "feedback_adjustment_failed", jobId: job.id };
  }
}

export async function applyAdjustmentDraft(draftId: string, coachUserId: string) {
  const { data: draft, error } = await (serviceRoleSupabase as any)
    .from("coach_plan_adjustment_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();
  if (error || !draft) throw new Error(error?.message || "draft_not_found");

  const { data: coach } = await (serviceRoleSupabase as any)
    .from("coaches")
    .select("user_id")
    .eq("id", draft.coach_id)
    .maybeSingle();

  if (coach?.user_id !== coachUserId) throw new Error("forbidden");
  if (draft.status === "applied") return draft;
  if (draft.status !== "draft") throw new Error("draft_not_applicable");

  const updatedTrainingDays = draft.proposed_patch?.updatedTrainingDays;
  if (!Array.isArray(updatedTrainingDays)) {
    throw new Error("draft_has_no_applicable_training_days");
  }

  await applyUpdatedTrainingDays(draft.plan_instance_id, updatedTrainingDays);
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await (serviceRoleSupabase as any)
    .from("coach_plan_adjustment_drafts")
    .update({ status: "applied", applied_at: now, updated_at: now })
    .eq("id", draft.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  if (draft.job_id) {
    await markAutomationJob(draft.job_id, "succeeded", {
      outputSnapshot: { draftId: draft.id, appliedBy: coachUserId },
    }).catch(() => undefined);
  }
  return updated;
}
