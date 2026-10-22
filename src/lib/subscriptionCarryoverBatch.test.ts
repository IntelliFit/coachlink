import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const mocks = vi.hoisted(() => ({
    handlers: {} as Record<string, (ctx: SupabaseExecContext) => any>,
    calls: [] as SupabaseExecContext[],
}));

vi.mock("@/lib/supabaseClient", () => ({
    default: createMockSupabase(async (ctx: SupabaseExecContext) => {
        mocks.calls.push(ctx);
        const handler = mocks.handlers[ctx.table];
        return handler ? handler(ctx) : { data: [], error: null };
    }),
}));

import {
    deriveSubscriptionCarryoverSummaryFromHistory,
    getSubscriptionCarryoverSummariesBatch,
    groupSubscriptionCarryoverHistory,
    selectCarryoverSubscriptionIds,
    summarizeSubscriptionCarryoverBatch,
} from "./subscriptionCarryover";

const plan = (weeks = 4, frequency = 3) => Array.from({ length: weeks * 7 }, (_, i) => ({
    dayIndex: i + 1,
    type: i % 7 < frequency ? "training" : "rest",
}));

const instances = [
    { id: "old-a", coach_subscription_id: "sub-a", status: "archived", created_at: "2026-08-01T00:00:00Z", training_days: plan() },
    { id: "cur-a", coach_subscription_id: "sub-a", status: "active", created_at: "2026-09-10T00:00:00Z", training_days: plan() },
    { id: "old-b", coach_subscription_id: "sub-b", status: "completed", created_at: "2026-07-01T00:00:00Z", training_days: plan() },
];
const exec = (id: string, instance_id: string, day_index: number, completed_at = "2026-09-05T00:00:00Z") => ({
    id, instance_id, day_index, status: "completed", completed_at,
});
const executions = [
    exec("e1", "old-a", 1),
    exec("e2", "old-a", 2),
    exec("e3", "cur-a", 1),
    exec("e4", "old-b", 1, "2026-07-02T00:00:00Z"),
    exec("orphan", "unknown-instance", 1),
];

beforeEach(() => {
    mocks.calls.length = 0;
    mocks.handlers = {
        coach_plan_instances: () => ({ data: instances, error: null }),
        plan_instance_executions: () => ({ data: executions, error: null }),
    };
});

describe("selectCarryoverSubscriptionIds", () => {
    it("keeps only trimmed, unique subscriptions with purchased weeks", () => {
        expect(selectCarryoverSubscriptionIds([
            { subscriptionId: " sub-a ", subscribedWeeks: 4 },
            { subscriptionId: "sub-a", subscribedWeeks: 4 },
            { subscriptionId: "sub-zero", subscribedWeeks: 0 },
            { subscriptionId: "sub-null", subscribedWeeks: null },
            { subscriptionId: "", subscribedWeeks: 4 },
            { subscriptionId: "sub-b", subscribedWeeks: 2 },
        ])).toEqual(["sub-a", "sub-b"]);
    });
});

describe("groupSubscriptionCarryoverHistory", () => {
    it("routes executions to subscriptions through their instance and drops orphans", () => {
        const history = groupSubscriptionCarryoverHistory(instances, executions);

        expect(history.instancesBySubscription.get("sub-a")?.map((i) => i.id)).toEqual(["old-a", "cur-a"]);
        expect(history.instancesBySubscription.get("sub-b")?.map((i) => i.id)).toEqual(["old-b"]);
        expect(history.executionsBySubscription.get("sub-a")?.map((e) => e.instance_id)).toEqual(["old-a", "old-a", "cur-a"]);
        expect(history.executionsBySubscription.get("sub-b")).toHaveLength(1);
        const allGrouped = Array.from(history.executionsBySubscription.values()).flat();
        expect(allGrouped.some((e) => e.instance_id === "unknown-instance")).toBe(false);
    });

    it("ignores instances without a subscription or id", () => {
        const history = groupSubscriptionCarryoverHistory(
            [{ id: "x", coach_subscription_id: null }, { id: "", coach_subscription_id: "sub-a" }],
            [exec("e", "x", 1)],
        );
        expect(history.instancesBySubscription.size).toBe(0);
        expect(history.executionsBySubscription.size).toBe(0);
    });
});

describe("summarizeSubscriptionCarryoverBatch", () => {
    it("applies each lookup's in-memory filters exactly like the single-subscription derivation", () => {
        const history = groupSubscriptionCarryoverHistory(instances, executions);
        const lookups = [
            {
                subscriptionId: "sub-a",
                subscribedWeeks: 4,
                excludeInstanceId: "cur-a",
                createdBefore: "2026-09-10T00:00:00Z",
                subscriptionStartDate: "2026-08-01T00:00:00Z",
            },
            { subscriptionId: "sub-b", subscribedWeeks: 2, subscriptionStartDate: "2026-08-01T00:00:00Z" },
        ];

        const summaries = summarizeSubscriptionCarryoverBatch(lookups, history);

        expect(summaries.get("sub-a")).toEqual(deriveSubscriptionCarryoverSummaryFromHistory({
            ...lookups[0],
            instances: instances.filter((i) => i.coach_subscription_id === "sub-a"),
            executions: executions.filter((e) => e.instance_id === "old-a" || e.instance_id === "cur-a"),
        }));
        // 当前实例被排除：只有 old-a 的两次训练计入
        expect(summaries.get("sub-a")?.sourceInstanceId).toBe("old-a");
        expect(summaries.get("sub-a")?.progressedWeeks).toBeCloseTo(2 / 3, 12);
        // 订阅开始前的训练不计入
        expect(summaries.get("sub-b")?.progressedWeeks).toBe(0);
        expect(summaries.get("sub-b")?.remainingWeeks).toBe(2);
    });

    it("returns an empty summary for zero-week subscriptions and ones with no history", () => {
        const summaries = summarizeSubscriptionCarryoverBatch(
            [{ subscriptionId: "sub-zero", subscribedWeeks: 0 }, { subscriptionId: "sub-new", subscribedWeeks: 3 }],
            groupSubscriptionCarryoverHistory([], []),
        );
        expect(summaries.get("sub-zero")).toEqual({
            purchasedWeeks: 0, progressedDayIndex: 0, progressedWeeks: 0,
            remainingWeeks: 0, sourceInstanceId: null, exhausted: true,
        });
        expect(summaries.get("sub-new")).toEqual({
            purchasedWeeks: 3, progressedDayIndex: 0, progressedWeeks: 0,
            remainingWeeks: 3, sourceInstanceId: null, exhausted: false,
        });
    });
});

describe("getSubscriptionCarryoverSummariesBatch", () => {
    const lookups = [
        { subscriptionId: "sub-a", subscribedWeeks: 4, excludeInstanceId: "cur-a" },
        { subscriptionId: "sub-b", subscribedWeeks: 2 },
        { subscriptionId: "sub-zero", subscribedWeeks: 0 },
    ];

    it("loads history in two queries and matches the pure two-step result", async () => {
        const summaries = await getSubscriptionCarryoverSummariesBatch(lookups);

        expect(mocks.calls.map((c) => c.table)).toEqual(["coach_plan_instances", "plan_instance_executions"]);
        const subscriptionFilter = mocks.calls[0].filters.find((f) => f.kind === "in" && f.args[0] === "coach_subscription_id");
        expect(subscriptionFilter?.args[1]).toEqual(["sub-a", "sub-b"]);
        expect(summaries).toEqual(
            summarizeSubscriptionCarryoverBatch(lookups, groupSubscriptionCarryoverHistory(instances, executions)),
        );
    });

    it("skips the database when no subscription has purchased weeks", async () => {
        const summaries = await getSubscriptionCarryoverSummariesBatch([{ subscriptionId: "sub-zero", subscribedWeeks: 0 }]);
        expect(mocks.calls).toHaveLength(0);
        expect(summaries.get("sub-zero")?.exhausted).toBe(true);
    });

    it("skips the executions query when there is no historical instance", async () => {
        mocks.handlers.coach_plan_instances = () => ({ data: [], error: null });
        const summaries = await getSubscriptionCarryoverSummariesBatch(lookups);
        expect(mocks.calls.map((c) => c.table)).toEqual(["coach_plan_instances"]);
        expect(summaries.get("sub-a")?.remainingWeeks).toBe(4);
    });

    it("still fails loudly when history cannot be read", async () => {
        mocks.handlers.plan_instance_executions = () => ({ data: null, error: { message: "boom" } });
        await expect(getSubscriptionCarryoverSummariesBatch(lookups)).rejects.toThrow("读取订阅历史训练失败: boom");
    });
});
