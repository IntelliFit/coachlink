import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type {
  AutomationContext,
  AutomationPolicy,
  FeedbackAdjustmentMode,
  InitialPlanMode,
  NextPhaseMode,
  RiskGuardMode,
} from "./types";

export const DEFAULT_AUTOMATION_POLICY: AutomationPolicy = {
  initialPlanMode: "auto_publish",
  feedbackAdjustmentMode: "draft_notify",
  nextPhaseMode: "draft_notify",
  riskGuardMode: "strict",
  source: "default",
};

const INITIAL_PLAN_MODES = new Set(["off", "draft", "auto_publish"]);
const FEEDBACK_MODES = new Set(["off", "draft_notify", "auto_apply_low_risk", "auto_apply_safe"]);
const NEXT_PHASE_MODES = new Set(["off", "draft_notify", "auto_publish_if_credits"]);
const RISK_MODES = new Set(["strict", "normal"]);

function pick<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  const raw = String(value || "").trim();
  return allowed.has(raw) ? (raw as T) : fallback;
}

function mergePolicy(
  base: AutomationPolicy,
  row: Record<string, unknown> | null | undefined,
  source: AutomationPolicy["source"],
): AutomationPolicy {
  if (!row) return base;
  return {
    initialPlanMode: pick<InitialPlanMode>(row.initial_plan_mode, INITIAL_PLAN_MODES, base.initialPlanMode),
    feedbackAdjustmentMode: pick<FeedbackAdjustmentMode>(
      row.feedback_adjustment_mode,
      FEEDBACK_MODES,
      base.feedbackAdjustmentMode,
    ),
    nextPhaseMode: pick<NextPhaseMode>(row.next_phase_mode, NEXT_PHASE_MODES, base.nextPhaseMode),
    riskGuardMode: pick<RiskGuardMode>(row.risk_guard_mode, RISK_MODES, base.riskGuardMode),
    source,
  };
}

export async function getAutomationContext(subscriptionId: string): Promise<AutomationContext | null> {
  const id = String(subscriptionId || "").trim();
  if (!id) return null;

  const { data: sub, error } = await (serviceRoleSupabase as any)
    .from("coach_subscriptions")
    .select("id, coach_id, student_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !sub?.coach_id || !sub?.student_id) return null;

  const { data: coach } = await (serviceRoleSupabase as any)
    .from("coaches")
    .select("user_id")
    .eq("id", sub.coach_id)
    .maybeSingle();

  return {
    subscriptionId: String(sub.id),
    coachId: String(sub.coach_id),
    studentId: String(sub.student_id),
    coachUserId: coach?.user_id ? String(coach.user_id) : null,
  };
}

export async function resolveAutomationPolicy(subscriptionId: string): Promise<{
  policy: AutomationPolicy;
  context: AutomationContext | null;
}> {
  const context = await getAutomationContext(subscriptionId);
  if (!context) return { policy: DEFAULT_AUTOMATION_POLICY, context: null };

  const [{ data: coachPolicy }, { data: override }] = await Promise.all([
    (serviceRoleSupabase as any)
      .from("coach_automation_policies")
      .select("initial_plan_mode, feedback_adjustment_mode, next_phase_mode, risk_guard_mode")
      .eq("coach_id", context.coachId)
      .maybeSingle(),
    (serviceRoleSupabase as any)
      .from("subscription_automation_overrides")
      .select("initial_plan_mode, feedback_adjustment_mode, next_phase_mode, risk_guard_mode")
      .eq("subscription_id", context.subscriptionId)
      .maybeSingle(),
  ]);

  const withCoach = mergePolicy(DEFAULT_AUTOMATION_POLICY, coachPolicy, coachPolicy ? "coach" : "default");
  const withOverride = mergePolicy(withCoach, override, override ? "subscription" : withCoach.source);
  return { policy: withOverride, context };
}
