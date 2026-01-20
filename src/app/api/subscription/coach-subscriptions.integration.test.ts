import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

let dataStore: Record<string, any> = {};

vi.mock("@/lib/supabaseClient", () => {
  const supabase = createMockSupabase((ctx: SupabaseExecContext) => {
    const key = `${ctx.table}:${ctx.op}`;
    const v = dataStore[key];
    if (typeof v === "function") return v(ctx);
    return v ?? { data: [], error: null };
  });
  return { default: supabase };
});

vi.mock("@/app/api/auth/[...nextauth]/auth", () => {
  return {
    getServerSession: async () => ({ user: { id: "u-1" } }),
  };
});

import { POST } from "./coach-subscriptions/route";

beforeEach(() => {
  dataStore = {};
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/subscription/coach-subscriptions (integration, mocked DB)", () => {
  it("marks has_plan_instance correctly even when computePauseAwareEndDate=false", async () => {
    dataStore["coach_subscriptions:select"] = {
      data: [
        { id: "sub-1", status: "active", coach_id: "c-1", student_id: "u-1", start_date: null, subscribed_weeks: 4 },
        { id: "sub-2", status: "active", coach_id: "c-2", student_id: "u-1", start_date: null, subscribed_weeks: 4 },
      ],
      error: null,
    };
    // only sub-2 has a plan instance
    dataStore["coach_plan_instances:select"] = {
      data: [
        { id: "inst-2", coach_subscription_id: "sub-2", created_at: "2026-01-01T00:00:00Z" },
      ],
      error: null,
    };
    dataStore["coaches:select"] = { data: [], error: null };

    const req = new Request("http://localhost/api/subscription/coach-subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId: "u-1", onlyActive: true, computePauseAwareEndDate: false }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);

    const subs = json.data.subscriptions as any[];
    const s1 = subs.find((s) => s.id === "sub-1");
    const s2 = subs.find((s) => s.id === "sub-2");
    expect(s1.has_plan_instance).toBe(false);
    expect(s2.has_plan_instance).toBe(true);
    expect(s2.latest_plan_instance_id).toBe("inst-2");
  });
});

