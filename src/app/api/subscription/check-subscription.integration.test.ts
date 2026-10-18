import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

// --- dynamic per-test state ---
const updates: Array<{ table: string; payload: any; filters: any[] }> = [];
let dataStore: Record<string, any> = {};

vi.mock("@/lib/supabaseClient", () => {
  const supabase = createMockSupabase((ctx: SupabaseExecContext) => {
    // Capture updates
    if (ctx.op === "update") {
      updates.push({ table: ctx.table, payload: ctx.payload, filters: ctx.filters });
      return { data: null, error: null };
    }
    // Return preloaded responses by table name + op
    const key = `${ctx.table}:${ctx.op}`;
    const v = dataStore[key];
    if (typeof v === "function") return v(ctx);
    return v ?? { data: [], error: null };
  });
  return { default: supabase };
});

const session = vi.hoisted(() => ({ isAdmin: true }));
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
  getServerSession: async () => ({ user: { id: "admin-1", is_admin: session.isAdmin } }),
}));

import { PUT } from "./check-subscription/route";

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

describe("PUT /api/subscription/check-subscription?action=check-expired (integration, mocked DB)", () => {
  it("refuses signed-in users who are not admins", async () => {
    session.isAdmin = false;
    try {
      const req = new Request("http://localhost/api/subscription/check-subscription?action=check-expired", { method: "PUT" });
      const res = await PUT(req);
      expect(res.status).toBe(403);
      expect(updates).toEqual([]);
    } finally { session.isAdmin = true; }
  });

  it("expires subscription when credits are fully consumed", async () => {
    dataStore["coach_subscriptions:select"] = {
      data: [{ id: "sub-1", status: "active", start_date: "2026-01-01", subscribed_weeks: 4 }],
      error: null,
    };
    dataStore["coach_plan_instances:select"] = {
      data: [{
        id: "inst-1",
        coach_subscription_id: "sub-1",
        start_execution_day: 1,
        training_days: makePlanTrainingDays({ weeks: 8, sessionsPerWeek: 3 }), // totalCredits in first 4 weeks => 12
        created_at: "2026-01-01",
      }],
      error: null,
    };
    dataStore["plan_instance_executions:select"] = {
      // Mark ALL eligible training days (3 sessions/week) in the 4-week window as completed:
      // week1: 1,2,3
      // week2: 8,9,10
      // week3: 15,16,17
      // week4: 22,23,24
      data: [1, 2, 3, 8, 9, 10, 15, 16, 17, 22, 23, 24].map((di) => ({
        instance_id: "inst-1",
        day_index: di,
        status: "completed",
      })),
      error: null,
    };

    const req = new Request("http://localhost/api/subscription/check-subscription?action=check-expired", { method: "PUT" });
    const res = await PUT(req);
    const json = await res.json();
    expect(json.success).toBe(true);

    const endUpdate = updates.find(
      (u) => u.table === "coach_subscriptions" && typeof u.payload?.end_date === "string",
    );
    expect(endUpdate).toBeTruthy();
  });

  it("refreshes end_date estimate when credits remain", async () => {
    dataStore["coach_subscriptions:select"] = {
      data: [{ id: "sub-1", status: "active", start_date: "2026-01-01", subscribed_weeks: 4 }],
      error: null,
    };
    dataStore["coach_plan_instances:select"] = {
      data: [{
        id: "inst-1",
        coach_subscription_id: "sub-1",
        start_execution_day: 1,
        training_days: makePlanTrainingDays({ weeks: 8, sessionsPerWeek: 3 }), // totalCredits => 12
        created_at: "2026-01-01",
      }],
      error: null,
    };
    // completed 3 credits => remaining 9; cadence 3/wk => remainingDays=ceil(9/3*7)=21 => end_date ~ 2026-01-22
    dataStore["plan_instance_executions:select"] = {
      data: [1, 2, 3].map((di) => ({ instance_id: "inst-1", day_index: di, status: "completed" })),
      error: null,
    };

    const req = new Request("http://localhost/api/subscription/check-subscription?action=check-expired", { method: "PUT" });
    const res = await PUT(req);
    const json = await res.json();
    expect(json.success).toBe(true);

    const refreshUpdates = updates.filter((u) =>
      u.table === "coach_subscriptions" && typeof u.payload?.end_date === "string",
    );
    expect(refreshUpdates.length).toBeGreaterThan(0);

    const endDateIso = refreshUpdates[0].payload.end_date as string;
    expect(endDateIso.startsWith("2026-01-22")).toBe(true);
  });

  it("does not cancel a stale-end-date subscription while unified credits remain", async () => {
    dataStore["coach_subscriptions:select"] = {
      data: [{
        id: "sub-stale",
        student_id: "student-1",
        status: "active",
        start_date: "2026-01-01",
        end_date: "2025-12-01T00:00:00.000Z",
        subscribed_weeks: 4,
      }],
      error: null,
    };
    dataStore["coach_plan_instances:select"] = {
      data: [{
        id: "inst-stale",
        coach_subscription_id: "sub-stale",
        start_execution_day: 1,
        training_days: makePlanTrainingDays({ weeks: 15, sessionsPerWeek: 4 }),
        created_at: "2026-01-01",
        status: "active",
      }],
      error: null,
    };
    dataStore["plan_instance_executions:select"] = {
      data: [1, 2, 3, 4].map((di) => ({
        instance_id: "inst-stale",
        day_index: di,
        status: "completed",
        completed_at: "2026-01-01T00:00:00.000Z",
      })),
      error: null,
    };

    const req = new Request("http://localhost/api/subscription/check-subscription?action=check-expired", { method: "PUT" });
    const res = await PUT(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.expiredCount).toBe(0);
    expect(json.data.refreshedCount).toBe(1);
    expect(updates.some((u) => u.payload?.status === "cancelled")).toBe(false);
    expect(updates.some((u) => u.table === "users")).toBe(false);
  });

  it("auto-cancels exhausted subscriptions after the 14-day grace deadline", async () => {
    vi.setSystemTime(new Date("2026-01-30T00:00:00.000Z"));
    dataStore["coach_subscriptions:select"] = {
      data: [{
        id: "sub-exhausted",
        student_id: "student-1",
        status: "active",
        start_date: "2026-01-01",
        end_date: "2026-01-01T00:00:00.000Z",
        subscribed_weeks: 1,
      }],
      error: null,
    };
    dataStore["coach_plan_instances:select"] = {
      data: [{
        id: "inst-exhausted",
        coach_subscription_id: "sub-exhausted",
        start_execution_day: 1,
        training_days: makePlanTrainingDays({ weeks: 4, sessionsPerWeek: 2 }),
        created_at: "2026-01-01",
        status: "active",
      }],
      error: null,
    };
    dataStore["plan_instance_executions:select"] = {
      data: [1, 2].map((di) => ({
        instance_id: "inst-exhausted",
        day_index: di,
        status: "completed",
        completed_at: "2026-01-01T00:00:00.000Z",
      })),
      error: null,
    };

    const req = new Request("http://localhost/api/subscription/check-subscription?action=check-expired", { method: "PUT" });
    const res = await PUT(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.expiredCount).toBe(1);
    expect(updates.some((u) =>
      u.table === "coach_subscriptions" && u.payload?.status === "cancelled"
    )).toBe(true);
    expect(updates.some((u) =>
      u.table === "users" && u.payload?.invitation_coach_id === null
    )).toBe(true);
  });
});

