import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => {
  const state: {
    subscription: any;
    coach: any;
    coachPolicy: any;
    override: any;
  } = {
    subscription: null,
    coach: null,
    coachPolicy: null,
    override: null,
  };

  function lookup(table: string, filters: Record<string, unknown>) {
    if (table === "coach_subscriptions") {
      return state.subscription?.id === filters.id ? state.subscription : null;
    }
    if (table === "coaches") {
      return state.coach?.id === filters.id ? state.coach : null;
    }
    if (table === "coach_automation_policies") {
      return state.coachPolicy?.coach_id === filters.coach_id ? state.coachPolicy : null;
    }
    if (table === "subscription_automation_overrides") {
      return state.override?.subscription_id === filters.subscription_id ? state.override : null;
    }
    return null;
  }

  const serviceRoleSupabase = {
    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          filters[column] = value;
          return query;
        }),
        maybeSingle: vi.fn(async () => ({ data: lookup(table, filters), error: null })),
      };
      return query;
    }),
  };

  return { state, serviceRoleSupabase };
});

vi.mock("@/lib/supabaseClient", () => ({
  serviceRoleSupabase: supabaseMock.serviceRoleSupabase,
}));

import { DEFAULT_AUTOMATION_POLICY, resolveAutomationPolicy } from "./policy";

describe("resolveAutomationPolicy", () => {
  beforeEach(() => {
    supabaseMock.serviceRoleSupabase.from.mockClear();
    supabaseMock.state.subscription = {
      id: "sub-1",
      coach_id: "coach-1",
      student_id: "student-1",
    };
    supabaseMock.state.coach = {
      id: "coach-1",
      user_id: "coach-user-1",
    };
    supabaseMock.state.coachPolicy = null;
    supabaseMock.state.override = null;
  });

  it("uses system defaults when no coach policy or override exists", async () => {
    const { policy, context } = await resolveAutomationPolicy("sub-1");

    expect(context).toEqual({
      subscriptionId: "sub-1",
      coachId: "coach-1",
      studentId: "student-1",
      coachUserId: "coach-user-1",
    });
    expect(policy).toEqual(DEFAULT_AUTOMATION_POLICY);
  });

  it("uses coach global policy over system defaults", async () => {
    supabaseMock.state.coachPolicy = {
      coach_id: "coach-1",
      initial_plan_mode: "draft",
      feedback_adjustment_mode: "auto_apply_low_risk",
      next_phase_mode: "off",
      risk_guard_mode: "normal",
    };

    const { policy } = await resolveAutomationPolicy("sub-1");

    expect(policy).toMatchObject({
      initialPlanMode: "draft",
      feedbackAdjustmentMode: "auto_apply_low_risk",
      nextPhaseMode: "off",
      riskGuardMode: "normal",
      source: "coach",
    });
  });

  it("lets subscription override win while null fields inherit coach policy", async () => {
    supabaseMock.state.coachPolicy = {
      coach_id: "coach-1",
      initial_plan_mode: "draft",
      feedback_adjustment_mode: "draft_notify",
      next_phase_mode: "draft_notify",
      risk_guard_mode: "strict",
    };
    supabaseMock.state.override = {
      subscription_id: "sub-1",
      initial_plan_mode: "auto_publish",
      feedback_adjustment_mode: null,
      next_phase_mode: "auto_publish_if_credits",
      risk_guard_mode: null,
    };

    const { policy } = await resolveAutomationPolicy("sub-1");

    expect(policy).toMatchObject({
      initialPlanMode: "auto_publish",
      feedbackAdjustmentMode: "draft_notify",
      nextPhaseMode: "auto_publish_if_credits",
      riskGuardMode: "strict",
      source: "subscription",
    });
  });
});
