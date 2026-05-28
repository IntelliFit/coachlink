import { beforeEach, describe, expect, it, vi } from "vitest";
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

import { refreshSubscriptionEntitlementSnapshot } from "./subscriptionEntitlementSnapshot";

function makeTrainingDays() {
  return Array.from({ length: 28 }, (_, index) => ({
    dayIndex: index + 1,
    type: (index % 7) + 1 <= 4 ? "training" : "rest",
  }));
}

beforeEach(() => {
  updates.length = 0;
  dataStore = {};
});

describe("refreshSubscriptionEntitlementSnapshot", () => {
  it("clears stale display end_date for active subscriptions when the model has no projection yet", async () => {
    dataStore["coach_subscriptions:select"] = {
      data: {
        id: "sub-not-started",
        status: "active",
        start_date: null,
        end_date: "2025-12-01T00:00:00.000Z",
        subscribed_weeks: 4,
      },
      error: null,
    };
    dataStore["coach_plan_instances:select"] = (ctx: SupabaseExecContext) => {
      const selected = String(ctx.filters.find((f) => f.kind === "select")?.args?.[0] || "");
      if (selected.includes("coach_subscription_id")) {
        return {
          data: [{
            id: "inst-not-started",
            coach_subscription_id: "sub-not-started",
            status: "active",
            start_execution_day: 1,
            training_days: makeTrainingDays(),
            created_at: "2026-01-01T00:00:00.000Z",
          }],
          error: null,
        };
      }

      return { data: [], error: null };
    };
    dataStore["plan_instance_executions:select"] = { data: [], error: null };

    const model = await refreshSubscriptionEntitlementSnapshot("sub-not-started", {
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(model?.displayEndDate).toBeNull();
    expect(updates).toContainEqual(expect.objectContaining({
      table: "coach_subscriptions",
      payload: expect.objectContaining({ end_date: null }),
    }));
  });
});
