import { describe, expect, it } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";
import {
  auditSubscriptionEntitlements,
  repairFalseBlockedSubscriptionEndDates,
} from "./subscriptionEntitlementAudit";

function makePlanTrainingDays(params: { weeks: number; sessionsPerWeek: number }) {
  const days: Array<{ dayIndex: number; type: string }> = [];
  for (let w = 0; w < params.weeks; w++) {
    for (let d = 1; d <= 7; d++) {
      days.push({
        dayIndex: w * 7 + d,
        type: d <= params.sessionsPerWeek ? "training" : "rest",
      });
    }
  }
  return days;
}

function makeAuditSupabase(updates: Array<{ table: string; payload: any; filters: any[] }>) {
  const subscriptions = [
    {
      id: "sub-false-blocked",
      student_id: "student-1",
      coach_id: "coach-1",
      status: "active",
      start_date: "2026-01-01T00:00:00.000Z",
      end_date: "2025-12-01T00:00:00.000Z",
      subscribed_weeks: 4,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "sub-exhausted",
      student_id: "student-2",
      coach_id: "coach-2",
      status: "active",
      start_date: "2026-01-01T00:00:00.000Z",
      end_date: "2026-01-01T00:00:00.000Z",
      subscribed_weeks: 1,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "sub-no-plan",
      student_id: "student-3",
      coach_id: "coach-3",
      status: "active",
      start_date: "2026-01-01T00:00:00.000Z",
      end_date: "2025-12-01T00:00:00.000Z",
      subscribed_weeks: 4,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  const instances = [
    {
      id: "inst-false-blocked",
      coach_subscription_id: "sub-false-blocked",
      student_id: "student-1",
      coach_id: "coach-1",
      name: "15-week plan",
      status: "active",
      start_execution_day: 1,
      training_days: makePlanTrainingDays({ weeks: 15, sessionsPerWeek: 4 }),
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "inst-exhausted",
      coach_subscription_id: "sub-exhausted",
      student_id: "student-2",
      coach_id: "coach-2",
      name: "short plan",
      status: "active",
      start_execution_day: 1,
      training_days: makePlanTrainingDays({ weeks: 4, sessionsPerWeek: 2 }),
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  const executions = [
    ...[1, 2, 3, 4].map((day_index) => ({
      id: `exec-false-${day_index}`,
      instance_id: "inst-false-blocked",
      day_index,
      status: "completed",
      completed_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    })),
    ...[1, 2].map((day_index) => ({
      id: `exec-exhausted-${day_index}`,
      instance_id: "inst-exhausted",
      day_index,
      status: "completed",
      completed_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    })),
  ];

  return createMockSupabase((ctx: SupabaseExecContext) => {
    if (ctx.op === "update") {
      updates.push({ table: ctx.table, payload: ctx.payload, filters: ctx.filters });
      return { data: null, error: null };
    }
    if (ctx.table === "coach_subscriptions") {
      return { data: subscriptions, error: null };
    }
    if (ctx.table === "coach_plan_instances") {
      return { data: instances, error: null };
    }
    if (ctx.table === "plan_instance_executions") {
      return { data: executions, error: null };
    }
    return { data: [], error: null };
  });
}

describe("subscriptionEntitlementAudit", () => {
  it("classifies stale end-date false blocks separately from true exhausted and no-plan rows", async () => {
    const updates: Array<{ table: string; payload: any; filters: any[] }> = [];
    const supabase = makeAuditSupabase(updates);

    const audit = await auditSubscriptionEntitlements({
      supabase: supabase as any,
      now: new Date("2026-01-30T00:00:00.000Z"),
    });

    const falseBlocked = audit.rows.find((row) => row.subscriptionId === "sub-false-blocked");
    const exhausted = audit.rows.find((row) => row.subscriptionId === "sub-exhausted");
    const noPlan = audit.rows.find((row) => row.subscriptionId === "sub-no-plan");

    expect(falseBlocked?.categories).toContain("false_blocked_by_stale_end_date");
    expect(falseBlocked?.model.lifecycleStatus).toBe("active");
    expect(falseBlocked?.model.remainingCredits).toBeGreaterThan(0);
    expect(exhausted?.categories).toContain("true_grace_or_exhausted_not_complete");
    expect(exhausted?.categories).toContain("should_auto_cancel");
    expect(noPlan?.categories).toContain("active_no_plan");
    expect(noPlan?.model.entitlementStatus).toBe("no_plan");
  });

  it("dry-runs by default and execute updates only false-blocked end_date rows", async () => {
    const dryRunUpdates: Array<{ table: string; payload: any; filters: any[] }> = [];
    const dryRunSupabase = makeAuditSupabase(dryRunUpdates);

    const dryRun = await repairFalseBlockedSubscriptionEndDates({
      supabase: dryRunSupabase as any,
      now: new Date("2026-01-30T00:00:00.000Z"),
    });

    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.matchedCount).toBe(1);
    expect(dryRun.updatedCount).toBe(0);
    expect(dryRunUpdates).toHaveLength(0);

    const executeUpdates: Array<{ table: string; payload: any; filters: any[] }> = [];
    const executeSupabase = makeAuditSupabase(executeUpdates);
    const executed = await repairFalseBlockedSubscriptionEndDates({
      supabase: executeSupabase as any,
      execute: true,
      now: new Date("2026-01-30T00:00:00.000Z"),
    });

    expect(executed.matchedCount).toBe(1);
    expect(executed.updatedCount).toBe(1);
    expect(executeUpdates).toHaveLength(1);
    expect(executeUpdates[0].table).toBe("coach_subscriptions");
    expect(executeUpdates[0].payload.end_date).toBe(executed.rows[0].newEndDate);
    expect(executeUpdates[0].filters.some((filter) =>
      filter.kind === "eq" && filter.args[0] === "id" && filter.args[1] === "sub-false-blocked"
    )).toBe(true);
  });
});
