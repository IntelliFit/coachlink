import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const updates: Array<{ table: string; payload: any; filters: any[] }> = [];
let dataStore: Record<string, any> = {};

vi.mock("@/lib/supabaseClient", () => {
  const supabase = createMockSupabase((ctx: SupabaseExecContext) => {
    if (ctx.op === "update") {
      updates.push({ table: ctx.table, payload: ctx.payload, filters: ctx.filters });
      return { data: { id: "sub-1", ...ctx.payload }, error: null };
    }

    const key = `${ctx.table}:${ctx.op}`;
    const value = dataStore[key];
    if (typeof value === "function") return value(ctx);
    return value ?? { data: [], error: null };
  });
  return { default: supabase };
});

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
  getServerSession: async () => ({
    user: { id: "coach-user-1", is_coach: true, is_admin: false },
  }),
}));

vi.mock("@/lib/chat", () => ({
  sendSystemMessage: vi.fn(async () => true),
}));

vi.mock("@/app/api/plan-lib/auto-match-plan/service", () => ({
  autoMatchPlanForSubscription: vi.fn(async () => ({ success: true })),
}));

import { POST } from "./update-subscription/route";

beforeEach(() => {
  updates.length = 0;
  dataStore = {};
});

describe("POST /api/subscription/update-subscription", () => {
  it("ignores client-provided end_date for active manual confirmation", async () => {
    dataStore["coach_subscriptions:select"] = {
      data: {
        id: "sub-1",
        student_id: "student-1",
        coach_id: "coach-1",
        status: "waiting",
        start_date: null,
        end_date: "2025-12-01T00:00:00.000Z",
        subscribed_weeks: 4,
        payment_method: "platform_wechat",
        payment_data: {
          provider: "wechat",
        },
      },
      error: null,
    };
    dataStore["coaches:select"] = (ctx: SupabaseExecContext) => {
      const selected = String(ctx.filters.find((f) => f.kind === "select")?.args?.[0] || "");
      if (selected === "id") return { data: { id: "coach-1" }, error: null };
      if (selected === "name, title") return { data: { name: "枭马葛", title: null }, error: null };
      if (selected === "user_id") return { data: { user_id: "coach-user-1" }, error: null };
      return { data: { id: "coach-1" }, error: null };
    };
    dataStore["coach_plan_instances:select"] = { data: [], error: null };

    const res = await POST(new Request("http://localhost/api/subscription/update-subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "sub-1",
        status: "active",
        end_date: "2026-06-01T00:00:00.000Z",
        payment_method: "platform_wechat",
      }),
    }));
    const json = await res.json();

    expect(json.success).toBe(true);
    const subscriptionUpdates = updates.filter((u) => u.table === "coach_subscriptions");
    expect(subscriptionUpdates[0].payload.status).toBe("active");
    expect(subscriptionUpdates[0].payload.end_date).not.toBe("2026-06-01T00:00:00.000Z");
    expect(subscriptionUpdates[0].payload.end_date).toBeNull();
  });
});
