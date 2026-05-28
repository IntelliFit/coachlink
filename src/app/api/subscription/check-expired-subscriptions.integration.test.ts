import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const updates: Array<{ table: string; payload: any; filters: any[] }> = [];
let dataStore: Record<string, any> = {};

vi.mock("@/lib/supabaseClient", () => {
  const supabase = createMockSupabase((ctx: SupabaseExecContext) => {
    if (ctx.op === "update") {
      updates.push({ table: ctx.table, payload: ctx.payload, filters: ctx.filters });
      return { data: null, error: null };
    }

    const key = `${ctx.table}:${ctx.op}`;
    const value = dataStore[key];
    if (typeof value === "function") return value(ctx);
    return value ?? { data: [], error: null };
  });
  return { default: supabase };
});

vi.mock("@/app/api/auth/[...nextauth]/auth", () => {
  return {
    getServerSession: async () => ({ user: { id: "admin-1" } }),
  };
});

import { POST } from "./check-expired-subscriptions/route";

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

beforeEach(() => {
  updates.length = 0;
  dataStore = {};
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/subscription/check-expired-subscriptions", () => {
  it("refreshes stale display end_date instead of cancelling when credits remain", async () => {
    dataStore["coach_subscriptions:select"] = {
      data: [{
        id: "sub-stale",
        student_id: "student-1",
        coach_id: "coach-1",
        status: "active",
        start_date: "2026-01-01T00:00:00.000Z",
        end_date: "2025-12-01T00:00:00.000Z",
        subscribed_weeks: 4,
      }],
      error: null,
    };
    dataStore["coach_plan_instances:select"] = {
      data: [{
        id: "inst-stale",
        coach_subscription_id: "sub-stale",
        status: "active",
        start_execution_day: 1,
        training_days: makePlanTrainingDays({ weeks: 15, sessionsPerWeek: 4 }),
        created_at: "2026-01-01T00:00:00.000Z",
      }],
      error: null,
    };
    dataStore["plan_instance_executions:select"] = {
      data: [1, 2, 3, 4].map((day_index) => ({
        instance_id: "inst-stale",
        day_index,
        status: "completed",
        completed_at: "2026-01-01T00:00:00.000Z",
      })),
      error: null,
    };

    const res = await POST(new Request("http://localhost/api/subscription/check-expired-subscriptions", { method: "POST" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.expiredCount).toBe(0);
    expect(json.data.refreshedCount).toBe(1);
    expect(updates.some((update) => update.payload?.status === "cancelled")).toBe(false);
    expect(updates.some((update) => update.table === "users")).toBe(false);
  });

  it("auto-cancels exhausted subscriptions after grace deadline", async () => {
    vi.setSystemTime(new Date("2026-01-30T00:00:00.000Z"));
    dataStore["coach_subscriptions:select"] = {
      data: [{
        id: "sub-exhausted",
        student_id: "student-1",
        coach_id: "coach-1",
        status: "active",
        start_date: "2026-01-01T00:00:00.000Z",
        end_date: "2026-01-01T00:00:00.000Z",
        subscribed_weeks: 1,
      }],
      error: null,
    };
    dataStore["coach_plan_instances:select"] = {
      data: [{
        id: "inst-exhausted",
        coach_subscription_id: "sub-exhausted",
        status: "active",
        start_execution_day: 1,
        training_days: makePlanTrainingDays({ weeks: 4, sessionsPerWeek: 2 }),
        created_at: "2026-01-01T00:00:00.000Z",
      }],
      error: null,
    };
    dataStore["plan_instance_executions:select"] = {
      data: [1, 2].map((day_index) => ({
        instance_id: "inst-exhausted",
        day_index,
        status: "completed",
        completed_at: "2026-01-01T00:00:00.000Z",
      })),
      error: null,
    };

    const res = await POST(new Request("http://localhost/api/subscription/check-expired-subscriptions", { method: "POST" }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.expiredCount).toBe(1);
    expect(updates.some((update) =>
      update.table === "coach_subscriptions" && update.payload?.status === "cancelled"
    )).toBe(true);
    expect(updates.some((update) =>
      update.table === "users" && update.payload?.invitation_coach_id === null
    )).toBe(true);
  });
});
