import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import { isStaleRunningJob, onSubscriptionActivated } from "@/lib/coachingAutomation";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

async function getCurrentCoach(req: Request) {
  const session = await getServerSession();
  const authResult = session?.user?.id
    ? { userId: session.user.id }
    : await getAuthUser(req);
  if (!authResult.userId) {
    return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) };
  }

  const { data: coach, error } = await (serviceRoleSupabase as any)
    .from("coaches")
    .select("id, user_id")
    .eq("user_id", authResult.userId)
    .maybeSingle();

  if (error || !coach?.id) {
    return { error: NextResponse.json({ success: false, message: "Coach not found" }, { status: 404 }) };
  }

  return { coach: { id: String(coach.id), userId: String(coach.user_id) } };
}

function parseLimit(value: string | null) {
  const limit = Number(value || 30);
  if (!Number.isFinite(limit)) return 30;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

export async function GET(req: Request) {
  const current = await getCurrentCoach(req);
  if (current.error) return current.error;

  const url = new URL(req.url);
  const subscriptionId = String(url.searchParams.get("subscriptionId") || "").trim();
  const limit = parseLimit(url.searchParams.get("limit"));

  let jobsQuery = (serviceRoleSupabase as any)
    .from("coach_automation_jobs")
    .select("*")
    .eq("coach_id", current.coach!.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  let draftsQuery = (serviceRoleSupabase as any)
    .from("coach_plan_adjustment_drafts")
    .select("*")
    .eq("coach_id", current.coach!.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (subscriptionId) {
    jobsQuery = jobsQuery.eq("subscription_id", subscriptionId);
    draftsQuery = draftsQuery.eq("subscription_id", subscriptionId);
  }

  const [{ data: jobs, error: jobsError }, { data: drafts, error: draftsError }] = await Promise.all([
    jobsQuery,
    draftsQuery,
  ]);

  if (jobsError || draftsError) {
    return NextResponse.json({
      success: false,
      message: jobsError?.message || draftsError?.message || "Failed to load automation jobs",
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      jobs: jobs || [],
      drafts: drafts || [],
    },
  });
}

/**
 * Re-runs a failed first-plan job. The job re-checks the subscription and
 * existing plans, so retrying after the coach already created a plan is a
 * no-op ("plan_instance_exists"). The coach gets the outcome as a system
 * message as well as in this response.
 */
export async function POST(req: Request) {
  const current = await getCurrentCoach(req);
  if (current.error) return current.error;

  const body = await req.json().catch(() => null);
  const jobId = String(body?.jobId || "").trim();
  if (body?.action !== "retry" || !jobId) {
    return NextResponse.json({ success: false, message: "缺少要重试的任务" }, { status: 400 });
  }

  const { data: job, error } = await (serviceRoleSupabase as any)
    .from("coach_automation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("coach_id", current.coach!.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
  if (!job?.subscription_id || job.type !== "initial_plan") {
    return NextResponse.json({ success: false, message: "只能重试首个训练计划任务" }, { status: 404 });
  }
  if (job.status !== "failed" && !isStaleRunningJob(job)) {
    return NextResponse.json({ success: false, message: "该任务不是失败状态，无需重试" }, { status: 409 });
  }

  const result = await onSubscriptionActivated(String(job.subscription_id), "coach_retry", {
    periodKey: job.input_snapshot?.periodKey || null,
  });
  return NextResponse.json({
    success: result.success,
    message: result.success ? "首个训练计划已生成" : `未生成计划：${result.reason || "未知原因"}`,
    data: result,
  });
}
