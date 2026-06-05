import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { resolveAutomationPolicy } from "@/lib/coachingAutomation";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

const INITIAL_PLAN_MODES = new Set(["off", "draft", "auto_publish"]);
const FEEDBACK_MODES = new Set(["off", "draft_notify", "auto_apply_low_risk", "auto_apply_safe"]);
const NEXT_PHASE_MODES = new Set(["off", "draft_notify", "auto_publish_if_credits"]);
const RISK_MODES = new Set(["strict", "normal"]);

async function getCurrentCoach() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) };
  }

  const { data: coach, error } = await (serviceRoleSupabase as any)
    .from("coaches")
    .select("id, user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !coach?.id) {
    return { error: NextResponse.json({ success: false, message: "Coach not found" }, { status: 404 }) };
  }

  return { coach: { id: String(coach.id), userId: String(coach.user_id) } };
}

function pickNullable(value: unknown, allowed: Set<string>) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const raw = String(value).trim();
  if (!allowed.has(raw)) throw new Error(`Invalid automation mode: ${raw}`);
  return raw;
}

async function getOwnedSubscription(subscriptionId: string, coachId: string) {
  const id = String(subscriptionId || "").trim();
  if (!id) return { error: NextResponse.json({ success: false, message: "Missing subscriptionId" }, { status: 400 }) };

  const { data: subscription, error } = await (serviceRoleSupabase as any)
    .from("coach_subscriptions")
    .select("id, coach_id, student_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !subscription) {
    return { error: NextResponse.json({ success: false, message: "Subscription not found" }, { status: 404 }) };
  }
  if (String(subscription.coach_id) !== coachId) {
    return { error: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }) };
  }

  return { subscription };
}

export async function GET(req: Request) {
  const current = await getCurrentCoach();
  if (current.error) return current.error;

  const url = new URL(req.url);
  const subscriptionId = url.searchParams.get("subscriptionId") || "";
  const owned = await getOwnedSubscription(subscriptionId, current.coach!.id);
  if (owned.error) return owned.error;

  const [{ data: override }, resolved] = await Promise.all([
    (serviceRoleSupabase as any)
      .from("subscription_automation_overrides")
      .select("*")
      .eq("subscription_id", subscriptionId)
      .maybeSingle(),
    resolveAutomationPolicy(subscriptionId),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      subscriptionId,
      override,
      effectivePolicy: resolved.policy,
      source: resolved.policy.source,
    },
  });
}

export async function PUT(req: Request) {
  const current = await getCurrentCoach();
  if (current.error) return current.error;

  const body = await req.json().catch(() => ({}));
  const subscriptionId = String(body.subscriptionId || body.subscription_id || "").trim();
  const owned = await getOwnedSubscription(subscriptionId, current.coach!.id);
  if (owned.error) return owned.error;

  let payload: Record<string, unknown>;
  try {
    payload = {
      subscription_id: subscriptionId,
      coach_id: current.coach!.id,
      student_id: owned.subscription!.student_id,
      initial_plan_mode: pickNullable(body.initialPlanMode ?? body.initial_plan_mode, INITIAL_PLAN_MODES),
      feedback_adjustment_mode: pickNullable(
        body.feedbackAdjustmentMode ?? body.feedback_adjustment_mode,
        FEEDBACK_MODES,
      ),
      next_phase_mode: pickNullable(body.nextPhaseMode ?? body.next_phase_mode, NEXT_PHASE_MODES),
      risk_guard_mode: pickNullable(body.riskGuardMode ?? body.risk_guard_mode, RISK_MODES),
      updated_at: new Date().toISOString(),
    };
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Invalid payload" }, { status: 400 });
  }

  const { data, error } = await (serviceRoleSupabase as any)
    .from("subscription_automation_overrides")
    .upsert(payload, { onConflict: "subscription_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  const resolved = await resolveAutomationPolicy(subscriptionId);

  return NextResponse.json({
    success: true,
    data: {
      subscriptionId,
      override: data,
      effectivePolicy: resolved.policy,
      source: resolved.policy.source,
    },
  });
}
