import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import { DEFAULT_AUTOMATION_POLICY } from "@/lib/coachingAutomation";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type {
  FeedbackAdjustmentMode,
  InitialPlanMode,
  NextPhaseMode,
  RiskGuardMode,
} from "@/lib/coachingAutomation/types";

const INITIAL_PLAN_MODES = new Set(["off", "draft", "auto_publish"]);
const FEEDBACK_MODES = new Set(["off", "draft_notify", "auto_apply_low_risk", "auto_apply_safe"]);
const NEXT_PHASE_MODES = new Set(["off", "draft_notify", "auto_publish_if_credits"]);
const RISK_MODES = new Set(["strict", "normal"]);

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

function pick<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  const raw = String(value || "").trim();
  return allowed.has(raw) ? (raw as T) : fallback;
}

function toPolicyPayload(row: any) {
  return {
    initialPlanMode: row?.initial_plan_mode || DEFAULT_AUTOMATION_POLICY.initialPlanMode,
    feedbackAdjustmentMode: row?.feedback_adjustment_mode || DEFAULT_AUTOMATION_POLICY.feedbackAdjustmentMode,
    nextPhaseMode: row?.next_phase_mode || DEFAULT_AUTOMATION_POLICY.nextPhaseMode,
    riskGuardMode: row?.risk_guard_mode || DEFAULT_AUTOMATION_POLICY.riskGuardMode,
  };
}

export async function GET(req: Request) {
  const current = await getCurrentCoach(req);
  if (current.error) return current.error;

  const { data: row, error } = await (serviceRoleSupabase as any)
    .from("coach_automation_policies")
    .select("*")
    .eq("coach_id", current.coach!.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      coachId: current.coach!.id,
      policy: toPolicyPayload(row),
      source: row ? "coach" : "default",
      row,
    },
  });
}

export async function PUT(req: Request) {
  const current = await getCurrentCoach(req);
  if (current.error) return current.error;

  const body = await req.json().catch(() => ({}));
  const payload = {
    coach_id: current.coach!.id,
    initial_plan_mode: pick<InitialPlanMode>(
      body.initialPlanMode ?? body.initial_plan_mode,
      INITIAL_PLAN_MODES,
      DEFAULT_AUTOMATION_POLICY.initialPlanMode,
    ),
    feedback_adjustment_mode: pick<FeedbackAdjustmentMode>(
      body.feedbackAdjustmentMode ?? body.feedback_adjustment_mode,
      FEEDBACK_MODES,
      DEFAULT_AUTOMATION_POLICY.feedbackAdjustmentMode,
    ),
    next_phase_mode: pick<NextPhaseMode>(
      body.nextPhaseMode ?? body.next_phase_mode,
      NEXT_PHASE_MODES,
      DEFAULT_AUTOMATION_POLICY.nextPhaseMode,
    ),
    risk_guard_mode: pick<RiskGuardMode>(
      body.riskGuardMode ?? body.risk_guard_mode,
      RISK_MODES,
      DEFAULT_AUTOMATION_POLICY.riskGuardMode,
    ),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (serviceRoleSupabase as any)
    .from("coach_automation_policies")
    .upsert(payload, { onConflict: "coach_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: {
      coachId: current.coach!.id,
      policy: toPolicyPayload(data),
      source: "coach",
      row: data,
    },
  });
}
