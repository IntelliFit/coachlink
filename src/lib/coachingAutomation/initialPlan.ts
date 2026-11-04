import {
  createAiInstanceForSubscription,
  PlanAlreadyExistsError,
} from "@/app/api/plan-lib/create-ai-instance/service";
import { sendSystemMessage } from "@/lib/chat";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { claimAutomationJob, createAutomationJob, isStaleRunningJob, markAutomationJob } from "./jobs";
import { startPlanIntake } from "./planIntake";
import type { PlanIntakeState } from "./planIntakeModel";
import { resolveAutomationPolicy } from "./policy";
import type { AutomationContext, AutomationJobRow, AutomationJobStatus, AutomationPolicy } from "./types";

// 计划助理私信只是补充信息，出错不能让首个计划任务失败。
async function startIntakeSafely(
  context: AutomationContext,
  planInstanceId: string,
  planPublished: boolean,
): Promise<PlanIntakeState | { status: "failed"; questions: []; error: string }> {
  try {
    return await startPlanIntake({ context, planInstanceId, planPublished });
  } catch (error) {
    console.error(`[automation] plan intake failed (planInstanceId=${planInstanceId}):`, error);
    return { status: "failed", questions: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export interface AutomationActionResult {
  success: boolean;
  reason?: string;
  error?: string;
  jobId?: string;
  planInstanceId?: string | null;
  /** Another trigger already handled, or is handling, this activation. */
  duplicate?: boolean;
}

export interface SubscriptionActivatedOptions {
  /**
   * Set when a reused subscription row starts a new paid period (the student
   * bought again after the old one ended), e.g. the subscribe order id. The
   * first period keeps the plain `initial_plan:<subscriptionId>` key.
   */
  periodKey?: string | null;
}

const CURRENT_PLAN_STATUSES = ["active", "paused", "draft", "scheduled"];
// 每次运行都会重新检查前置条件，所以失败、跳过（当时未激活、托管关闭）的任务都可以再跑。
const RERUNNABLE_STATUSES: AutomationJobStatus[] = ["pending", "failed", "skipped"];
const STUDENTS_LINK = "[我的学员](/dashboard/students)";

export function initialPlanIdempotencyKey(subscriptionId: string, periodKey?: string | null) {
  const period = String(periodKey || "").trim();
  return period ? `initial_plan:${subscriptionId}:${period}` : `initial_plan:${subscriptionId}`;
}

async function notifyCoach(context: AutomationContext, content: string) {
  if (!context.coachUserId) return false;
  try {
    return Boolean(await sendSystemMessage(context.coachUserId, { content }));
  } catch (error) {
    console.error("[automation] notify coach failed:", error);
    return false;
  }
}

function fallbackNote(plan: any) {
  const fallback = plan?.ai_generation_log?.fallback;
  if (!fallback?.reason) return "";
  const how = fallback.mode === "closest_match" ? "模板库里最接近的模板" : "规则匹配的模板";
  return `AI 个性化没有成功（${fallback.reason}），本次按${how}生成，建议看一下是否合适。`;
}

async function findPlanForSubscription(subscriptionId: string, currentOnly: boolean) {
  let query = (serviceRoleSupabase as any)
    .from("coach_plan_instances")
    .select("id, status")
    .eq("coach_subscription_id", subscriptionId);
  if (currentOnly) query = query.in("status", CURRENT_PLAN_STATUSES);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`查询学员计划失败: ${error.message}`);
  return data?.id ? (data as { id: string; status: string }) : null;
}

export async function onSubscriptionActivated(
  subscriptionId: string,
  triggerSource = "subscription_activated",
  options: SubscriptionActivatedOptions = {},
): Promise<AutomationActionResult> {
  const { policy, context } = await resolveAutomationPolicy(subscriptionId);
  if (!context) return { success: false, reason: "subscription_not_found" };

  const periodKey = String(options.periodKey || "").trim() || null;
  let job: AutomationJobRow;
  try {
    job = await createAutomationJob({
      type: "initial_plan",
      triggerSource,
      idempotencyKey: initialPlanIdempotencyKey(context.subscriptionId, periodKey),
      subscriptionId: context.subscriptionId,
      coachId: context.coachId,
      studentId: context.studentId,
      inputSnapshot: { policy, periodKey },
    });

    if (job.status === "succeeded" || job.status === "needs_coach_review") {
      return { success: true, reason: "already_handled", duplicate: true, jobId: job.id, planInstanceId: job.plan_instance_id };
    }
    // 支付回调、轮询和返回页可能同时到达；只有抢到任务的那一路生成计划，否则会生成两份。
    if (!(await claimAutomationJob(job, RERUNNABLE_STATUSES))) {
      return { success: false, reason: "in_progress", duplicate: true, jobId: job.id };
    }
  } catch (error: any) {
    // 任务都没建起来时没有失败记录可查，也不会被后台重试捡到，只能直接告诉教练。
    const message = error?.message || String(error);
    console.error(`[automation] initial plan job could not start (subscriptionId=${subscriptionId}):`, error);
    await notifyCoach(
      context,
      `新学员已付款，但首个训练计划任务没能启动：${message}。请前往 ${STUDENTS_LINK} 为 TA 创建训练计划。`,
    );
    return { success: false, reason: message, error: message };
  }

  const attempts = Number(job.output_snapshot?.attempts || 0) + 1;
  try {
    return await runInitialPlan({ job, policy, context, periodKey, attempts });
  } catch (error: any) {
    const message = error?.message || String(error);
    // 同一个失败只提醒一次；教练手动点重试时每次都回复结果。
    const alreadyNotified = Boolean(job.output_snapshot?.coachNotifiedAt) && triggerSource !== "coach_retry";
    const notified = alreadyNotified
      ? false
      : await notifyCoach(
        context,
        `新学员已付款，但首个训练计划自动生成失败：${message}。学员现在还没有计划，请前往 ${STUDENTS_LINK} 为 TA 创建；处理好原因后也可以在 [自动托管](/dashboard/automation) 的任务列表里重新生成。`,
      );
    await markAutomationJob(job.id, "failed", {
      errorMessage: message,
      outputSnapshot: {
        failedAt: new Date().toISOString(),
        attempts,
        coachNotifiedAt: notified ? new Date().toISOString() : job.output_snapshot?.coachNotifiedAt || null,
      },
    }).catch(() => undefined);
    return {
      success: false,
      reason: message || "initial_plan_failed",
      error: error instanceof Error ? error.message : String(error),
      jobId: job.id,
    };
  }
}

async function runInitialPlan(params: {
  job: AutomationJobRow;
  policy: AutomationPolicy;
  context: AutomationContext;
  periodKey: string | null;
  attempts: number;
}): Promise<AutomationActionResult> {
  const { job, policy, context, periodKey, attempts } = params;
  const skip = async (reason: string, extra: Record<string, unknown> = {}, planInstanceId?: string) => {
    await markAutomationJob(job.id, "skipped", {
      ...(planInstanceId ? { planInstanceId } : {}),
      outputSnapshot: { reason, attempts, ...extra },
    });
    return { success: false, reason, jobId: job.id, planInstanceId: planInstanceId || null };
  };

  if (policy.initialPlanMode === "off") {
    if (job.output_snapshot?.reason !== "initial_plan_mode_off") {
      await notifyCoach(context, `新学员已付款。你关闭了自动生成首个计划，请前往 ${STUDENTS_LINK} 为 TA 创建训练计划。`);
    }
    return skip("initial_plan_mode_off");
  }

  const { data: subscription, error: subError } = await (serviceRoleSupabase as any)
    .from("coach_subscriptions")
    .select("id, status, subscribe_data")
    .eq("id", context.subscriptionId)
    .single();
  if (subError || !subscription) throw new Error(subError?.message || "subscription_not_found");
  if (subscription.status !== "active") return skip("subscription_not_active");

  // 首个周期：任何计划（含教练已建后归档的）都说明不需要自动建；
  // 重新购买的新周期：旧周期留下的已完成/归档计划不算，只看当前计划。
  const existing = await findPlanForSubscription(context.subscriptionId, Boolean(periodKey));
  if (existing) return skip("plan_instance_exists", { existing }, existing.id);

  // 教练没有问卷时 subscribe_data 为空，仍按学员档案生成，不能让付了款的学员一直没有计划。
  const questionnaireEmpty = !Array.isArray(subscription.subscribe_data) || subscription.subscribe_data.length === 0;

  const initialStatus = policy.initialPlanMode === "draft" ? "draft" : "active";
  let plan: any;
  try {
    plan = await createAiInstanceForSubscription({
      actorUserId: context.coachUserId || context.coachId,
      actorCoachId: context.coachId,
      subscriptionId: context.subscriptionId,
      initialStatus,
      useLLM: true,
      skipIfCurrentPlanExists: true,
    });
  } catch (error) {
    if (error instanceof PlanAlreadyExistsError) {
      return skip("plan_instance_exists", { createdDuringRun: true }, error.planInstanceId);
    }
    throw error;
  }

  const intake = await startIntakeSafely(context, plan.id, initialStatus === "active");
  const askedCount = intake.status === "awaiting_reply" ? intake.questions.length : 0;
  const intakeLine = askedCount > 0
    ? `计划助理已私信学员确认 ${askedCount} 项信息（1RM、体重或疑问），学员回复后会通知你。`
    : "";
  const questionnaireLine = questionnaireEmpty ? "学员没有填写问卷，计划按学员档案生成。" : "";
  const notes = `${fallbackNote(plan)}${questionnaireLine}${intakeLine}`;
  const outputSnapshot = {
    planId: plan.id,
    status: initialStatus,
    intake,
    attempts,
    questionnaireEmpty,
    fallback: plan.ai_generation_log?.fallback || null,
  };

  // 计划已经建好：记录状态失败也不能再走失败分支告诉教练「没有计划」。任务会留在 running，
  // 过期后被后台重试捡到，那时会因为已有计划而跳过。
  const draft = initialStatus === "draft";
  await markAutomationJob(job.id, draft ? "needs_coach_review" : "succeeded", {
    planInstanceId: plan.id,
    ...(draft ? { needsCoachConfirmation: true } : {}),
    outputSnapshot,
  }).catch((error) => console.error(`[automation] mark initial plan job failed (jobId=${job.id}):`, error));
  await notifyCoach(
    context,
    draft
      ? `系统已为新学员生成首个训练计划草稿：${plan.name || "未命名计划"}。请前往 ${STUDENTS_LINK} 确认后发布。${notes}`
      : `新学员的训练计划已自动发放：${plan.name || "未命名计划"}，学员现在可以在今日训练查看。${notes}`,
  );

  return { success: true, jobId: job.id, planInstanceId: plan.id };
}

const RETRY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_FAILED_AFTER_MS = 30 * 60 * 1000;
const RETRY_PENDING_AFTER_MS = 5 * 60 * 1000;
const MAX_AUTOMATIC_ATTEMPTS = 3;

/** Which unfinished initial_plan jobs the background retry should pick up. */
export function isRetryableInitialPlanJob(job: AutomationJobRow & { finished_at?: string | null; created_at?: string | null }, nowMs = Date.now()) {
  if (job.type !== "initial_plan" || !job.subscription_id) return false;
  if (job.status === "running") return isStaleRunningJob(job, nowMs);
  if (job.status === "pending") {
    // 建了任务还没抢到就重启了进程。
    return nowMs - Date.parse(String(job.updated_at || job.created_at || "")) > RETRY_PENDING_AFTER_MS;
  }
  if (job.status === "failed") {
    const attempts = Number(job.output_snapshot?.attempts || 1);
    const failedAt = Date.parse(String(job.finished_at || job.updated_at || ""));
    return attempts < MAX_AUTOMATIC_ATTEMPTS && Number.isFinite(failedAt) && nowMs - failedAt > RETRY_FAILED_AFTER_MS;
  }
  return false;
}

/**
 * Background retry for first plans that never finished: the pod was replaced
 * mid-run (the job is stuck in running), or the run failed for a reason that
 * may be gone now. Each retry re-checks the subscription and existing plans.
 */
export async function retryUnfinishedInitialPlans(limit = 5) {
  const since = new Date(Date.now() - RETRY_LOOKBACK_MS).toISOString();
  const { data, error } = await (serviceRoleSupabase as any)
    .from("coach_automation_jobs")
    .select("*")
    .eq("type", "initial_plan")
    .in("status", ["pending", "running", "failed"])
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;

  const jobs = ((data || []) as AutomationJobRow[]).filter((job) => isRetryableInitialPlanJob(job)).slice(0, limit);
  const results: AutomationActionResult[] = [];
  for (const job of jobs) {
    results.push(await onSubscriptionActivated(String(job.subscription_id), "initial_plan_retry", {
      periodKey: job.input_snapshot?.periodKey || null,
    }));
  }
  return results;
}
