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
    buildPageInstanceFilter,
    buildStudentPlanData,
    loadStudentPageData,
    pickLatestPlanInstanceByStudent,
    splitEmbeddedExecutions,
} from "./studentPageData";
import {
    getSubscriptionCarryoverSummariesBatch,
    summarizeSubscriptionCarryoverBatch,
} from "@/lib/subscriptionCarryover";

const COACH = "coach-1";
const days = (count: number) => Array.from({ length: count }, (_, i) => ({ dayIndex: i + 1, type: "training" }));
const done = (id: string, instance_id: string, day_index: number) => ({
    id, instance_id, day_index, status: "completed", completed_at: "2026-09-20T00:00:00Z",
});
const inst = (overrides: Record<string, any>): Record<string, any> => ({
    coach_id: COACH,
    name: "计划",
    description: null,
    training_days_count: 0,
    start_execution_day: 1,
    training_days: days(4),
    executions: [],
    ...overrides,
});

describe("buildPageInstanceFilter", () => {
    it("unions the current-plan and carryover filters", () => {
        expect(buildPageInstanceFilter({ coachId: COACH, studentIds: ["s1", "s2"], subscriptionIds: ["sub-1"] })).toBe(
            "and(coach_id.eq.coach-1,student_id.in.(s1,s2),status.in.(active,paused,completed))," +
            "and(coach_subscription_id.in.(sub-1),status.in.(active,paused,completed,scheduled,archived))",
        );
    });

    it("omits empty branches", () => {
        expect(buildPageInstanceFilter({ coachId: COACH, studentIds: ["s1"], subscriptionIds: [] }))
            .toBe("and(coach_id.eq.coach-1,student_id.in.(s1),status.in.(active,paused,completed))");
        expect(buildPageInstanceFilter({ coachId: COACH, studentIds: [], subscriptionIds: [] })).toBeNull();
    });
});

describe("pickLatestPlanInstanceByStudent", () => {
    it("prefers the newest active/paused plan, then the newest completed one", () => {
        const latest = pickLatestPlanInstanceByStudent([
            inst({ id: "s1-active-old", student_id: "s1", status: "active", created_at: "2026-01-01" }),
            inst({ id: "s1-paused-new", student_id: "s1", status: "paused", created_at: "2026-02-01" }),
            inst({ id: "s1-completed-newest", student_id: "s1", status: "completed", created_at: "2026-03-01" }),
            inst({ id: "s2-completed-old", student_id: "s2", status: "completed", created_at: "2026-01-01" }),
            inst({ id: "s2-completed-new", student_id: "s2", status: "completed", created_at: "2026-02-01" }),
            inst({ id: "s2-archived-newest", student_id: "s2", status: "archived", created_at: "2026-04-01" }),
            inst({ id: "s3-other-coach", student_id: "s3", status: "active", coach_id: "coach-2", created_at: "2026-04-01" }),
            inst({ id: "s9-off-page", student_id: "s9", status: "active", created_at: "2026-04-01" }),
        ], COACH, ["s1", "s2", "s3"]);

        expect(Object.fromEntries(Array.from(latest, ([sid, row]) => [sid, row.id]))).toEqual({
            s1: "s1-paused-new",
            s2: "s2-completed-new",
        });
    });
});

describe("splitEmbeddedExecutions", () => {
    it("strips the embedded executions and dedupes both lists by id", () => {
        const a = inst({ id: "a", executions: [done("e1", "a", 1)] });
        const { instances, executions } = splitEmbeddedExecutions([a, { ...a }, inst({ id: "b", executions: null })]);
        expect(instances.map((i) => i.id)).toEqual(["a", "b"]);
        expect(instances.every((i) => !("executions" in i))).toBe(true);
        expect(executions.map((e) => e.id)).toEqual(["e1"]);
    });
});

describe("buildStudentPlanData", () => {
    it("summarizes the chosen plan and defaults students without one", () => {
        const plan = inst({ id: "p1", student_id: "s1", status: "active", created_at: "2026-09-01" });
        const result = buildStudentPlanData(
            ["s1", "s2"],
            new Map([["s1", plan]]),
            [done("e1", "p1", 1), done("e2", "p1", 2), { ...done("e3", "p1", 3), status: "in_progress" }, done("x", "other", 1)],
        );

        expect(result.get("s1")).toMatchObject({
            plan: { id: "p1", status: "active", raw_status: "active", is_logically_completed: false, description: "" },
            progress: { total: 4, completed: 2 },
            instanceMeta: { instance_id: "p1", created_at: "2026-09-01", start_execution_day: 1 },
        });
        expect(result.get("s1")?.instanceMeta?.executions).toEqual([
            { day_index: 1, status: "completed" },
            { day_index: 2, status: "completed" },
        ]);
        expect(result.get("s2")).toEqual({ plan: null, progress: { total: 0, completed: 0 } });
    });

    it("derives completed status for an active plan whose training days are all done", () => {
        const plan = inst({ id: "p1", student_id: "s1", status: "active", training_days: days(2) });
        const result = buildStudentPlanData(["s1"], new Map([["s1", plan]]), [done("e1", "p1", 1), done("e2", "p1", 2)]);
        expect(result.get("s1")?.plan).toMatchObject({ status: "completed", raw_status: "active", is_logically_completed: true });
    });
});

describe("loadStudentPageData", () => {
    const rows = [
        // s1 当前计划，同时属于 sub-1 的历史
        inst({ id: "cur-1", student_id: "s1", coach_subscription_id: "sub-1", status: "active", created_at: "2026-09-10",
            executions: [done("e-cur", "cur-1", 1)] }),
        // sub-1 的归档历史
        inst({ id: "old-1", student_id: "s1", coach_subscription_id: "sub-1", status: "archived", created_at: "2026-08-01",
            executions: [done("e-old-1", "old-1", 1), done("e-old-2", "old-1", 2)] }),
        // s2 的计划，但 sub-2 没买周数，不进入 carryover
        inst({ id: "cur-2", student_id: "s2", coach_subscription_id: "sub-2", status: "active", created_at: "2026-09-01" }),
    ];
    const refs = [
        { subscriptionId: "sub-1", studentId: "s1", loadCarryover: true },
        { subscriptionId: "sub-2", studentId: "s2", loadCarryover: false },
    ];

    beforeEach(() => {
        mocks.calls.length = 0;
        mocks.handlers = { coach_plan_instances: () => ({ data: rows, error: null }) };
    });

    it("reads plans, carryover history and completed executions in one query", async () => {
        const { planDetailByStudentId, carryoverHistory } = await loadStudentPageData({ coachId: COACH, refs });

        expect(mocks.calls).toHaveLength(1);
        const filters = mocks.calls[0].filters;
        expect(filters.find((f) => f.kind === "select")?.args[0]).toContain(
            "executions:plan_instance_executions!plan_instance_executions_instance_id_fkey(",
        );
        expect(filters).toContainEqual({ kind: "eq", args: ["executions.status", "completed"] });
        expect(filters.find((f) => f.kind === "or")?.args[0]).toBe(
            buildPageInstanceFilter({ coachId: COACH, studentIds: ["s1", "s2"], subscriptionIds: ["sub-1"] }),
        );

        expect(planDetailByStudentId.get("s1")?.plan?.id).toBe("cur-1");
        expect(planDetailByStudentId.get("s1")?.progress.completed).toBe(1);
        expect(planDetailByStudentId.get("s2")?.plan?.id).toBe("cur-2");
        expect(carryoverHistory.instancesBySubscription.get("sub-1")?.map((i) => i.id)).toEqual(["cur-1", "old-1"]);
        expect(carryoverHistory.instancesBySubscription.has("sub-2")).toBe(false);
        expect(carryoverHistory.executionsBySubscription.get("sub-1")?.map((e) => (e as any).id)).toEqual(["e-cur", "e-old-1", "e-old-2"]);
    });

    it("gives the same carryover summary as the standalone two-query batch", async () => {
        const { planDetailByStudentId, carryoverHistory } = await loadStudentPageData({ coachId: COACH, refs });
        const meta = planDetailByStudentId.get("s1")?.instanceMeta;
        const lookups = [{
            subscriptionId: "sub-1",
            subscribedWeeks: 4,
            excludeInstanceId: meta?.instance_id,
            createdBefore: meta?.created_at,
            subscriptionStartDate: "2026-07-01",
        }];

        mocks.handlers = {
            coach_plan_instances: () => ({
                data: rows.filter((r) => r.coach_subscription_id === "sub-1")
                    .map(({ executions: _executions, ...instance }) => instance),
                error: null,
            }),
            plan_instance_executions: () => ({ data: rows.flatMap((r) => r.executions), error: null }),
        };
        const standalone = await getSubscriptionCarryoverSummariesBatch(lookups);

        expect(summarizeSubscriptionCarryoverBatch(lookups, carryoverHistory)).toEqual(standalone);
        expect(standalone.get("sub-1")?.sourceInstanceId).toBe("old-1");
    });

    it("skips the database for an empty page", async () => {
        await loadStudentPageData({ coachId: COACH, refs: [] });
        expect(mocks.calls).toHaveLength(0);
    });

    it("fails loudly instead of under-reporting history", async () => {
        mocks.handlers.coach_plan_instances = () => ({ data: null, error: { message: "boom" } });
        await expect(loadStudentPageData({ coachId: COACH, refs })).rejects.toThrow("读取学员计划失败: boom");
    });
});
