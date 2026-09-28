import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveStrictSequentialProgressDay } from "@/lib/planProgress";
import { computeUsedCredits } from "@/lib/subscriptionCredits";

const mocks = vi.hoisted(() => ({
    rows: new Map<string, any>(),
    beforeUpdate: null as null | (() => void),
    refresh: vi.fn(),
    autoE1RM: vi.fn(),
}));

vi.mock("@/lib/getApiUserId", () => ({ getApiUserId: async () => "student" }));
vi.mock("@/lib/planExecutionLifecycle", () => ({
    PLAN_EXECUTION_HARD_TIMEOUT_MS: 5 * 60 * 60 * 1000,
    expireTimedOutPlanExecutions: vi.fn(async () => []),
    activatePendingPlanRevisionForSource: vi.fn(async () => ({ activated: false })),
}));
vi.mock("@/app/api/execution/_helpers/subscriptionAccess", () => ({
    validateExecutionSubscriptionAccess: async () => ({ allowed: true }),
}));
vi.mock("@/app/api/execution/updateEstimatedEndDate", () => ({
    updateEstimatedEndDateForInstance: mocks.refresh,
}));
vi.mock("@/lib/autoE1rmTracking", () => ({ handleAutoE1RMCheck: mocks.autoE1RM }));
vi.mock("@/lib/workoutEnergyExecution", () => ({
    attachWorkoutEnergyEstimate: async ({ actionExecutions }: any) => ({
        estimate: null, actionExecutions,
    }),
}));

// Models conditional UPDATE semantics, not a database/transaction integration test.
vi.mock("@/lib/supabaseClient", () => {
    const client = {
        from(table: string) {
            let patch: any;
            const filters: Array<(row: any) => boolean> = [];
            const execute = () => {
                if (table !== "plan_instance_executions") return { data: null, error: null };
                if (patch && mocks.beforeUpdate) {
                    const hook = mocks.beforeUpdate;
                    mocks.beforeUpdate = null;
                    hook();
                }
                const row = [...mocks.rows.values()].find((value) => filters.every((f) => f(value)));
                if (!row) return { data: null, error: null };
                if (patch) {
                    Object.assign(row, structuredClone(patch));
                    row.updated_at = new Date(new Date(row.updated_at).getTime() + 1).toISOString();
                }
                return { data: structuredClone(row), error: null };
            };
            const query: any = {
                select: () => query,
                update: (value: any) => { patch = value; return query; },
                eq: (key: string, value: any) => { filters.push((r) => r[key] === value); return query; },
                is: (key: string, value: any) => { filters.push((r) => r[key] === value); return query; },
                gt: (key: string, value: string) => { filters.push((r) => r[key] > value); return query; },
                single: async () => execute(),
                maybeSingle: async () => execute(),
                then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
            };
            return query;
        },
    };
    return { default: client, serviceRoleSupabase: client };
});

import { POST as completeSet } from "@/app/api/execution/complete-set/route";
import { POST as completeItem } from "@/app/api/execution/complete-item/route";
import { POST as finish } from "@/app/api/execution/finish/route";

const FIRST_COMPLETION = "2026-09-10T08:00:00.000Z";
const FIRST_ITEM_COMPLETION = "2026-09-10T07:50:00.000Z";

function execution(overrides: Record<string, unknown> = {}) {
    return {
        id: "execution", instance_id: "plan", student_id: "student", day_index: 1,
        status: "completed", completed_at: FIRST_COMPLETION,
        started_at: "2026-09-10T07:00:00.000Z", updated_at: FIRST_COMPLETION,
        last_saved_at: FIRST_COMPLETION, completed_sets: 1, total_sets: 1,
        action_executions: [{
            action_id: "action", action_name: "test", item_type: "STRENGTH",
            sets: [{ status: "completed", completed_at: FIRST_ITEM_COMPLETION, actual_reps: 5 }],
        }],
        ...overrides,
    };
}

function request(body: unknown) {
    return new Request("http://localhost/api/execution/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }) as never;
}

describe("historical completion must not be a new workout", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-09-26T04:00:00.000Z"));
        mocks.rows.clear();
        mocks.rows.set("execution", execution());
        mocks.beforeUpdate = null;
        mocks.refresh.mockReset();
        mocks.autoE1RM.mockReset().mockResolvedValue(null);
    });
    afterEach(() => vi.useRealTimers());

    it("the first automatic completion happens once, and a later retry preserves it", async () => {
        mocks.rows.set("execution", execution({
            status: "in_progress", completed_at: null, started_at: new Date().toISOString(),
            completed_sets: 0, action_executions: [{ sets: [{ status: "pending" }] }],
        }));
        const body = { executionId: "execution", actionIndex: 0, setIndex: 0 };
        expect((await completeSet(request(body))).status).toBe(200);
        expect(mocks.rows.get("execution").completed_at).toBe("2026-09-26T04:00:00.000Z");
        vi.setSystemTime(new Date("2026-10-10T04:00:00.000Z"));
        expect((await completeSet(request(body))).status).toBe(200);
        expect(mocks.rows.get("execution").completed_at).toBe("2026-09-26T04:00:00.000Z");
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it("a partial edit preserves existing video and recorded values", async () => {
        const row = mocks.rows.get("execution");
        Object.assign(row.action_executions[0].sets[0], {
            actual_weight: 35, has_video: true, video_url: "existing-video", is_pr: true,
        });
        expect((await completeSet(request({ executionId: "execution", actionIndex: 0, setIndex: 0, notes: "correction" }))).status).toBe(200);
        expect(mocks.rows.get("execution").action_executions[0].sets[0]).toMatchObject({
            actual_weight: 35, actual_reps: 5, has_video: true, video_url: "existing-video", is_pr: true, notes: "correction",
        });
    });

    it("keeps the original day, progress and consumed credits through repeated historical set edits", async () => {
        const later = execution({ id: "later", day_index: 4, completed_at: "2026-09-14T08:00:00Z" });
        const progress = () => deriveStrictSequentialProgressDay({
            planDays: Array.from({ length: 7 }, (_, i) => ({
                dayIndex: i + 1, type: [1, 4, 7].includes(i + 1) ? "training" : "rest",
            })),
            startExecutionDay: 1,
            executionsByDayIndex: { 1: mocks.rows.get("execution"), 4: later },
            explicitStartDate: "2026-09-10", today: new Date("2026-09-26T04:00:00Z"),
        }).recommendedDayIndex;
        expect(progress()).toBe(7);
        for (let i = 0; i < 10; i++) {
            const response = await completeSet(request({ executionId: "execution", actionIndex: 0, setIndex: 0, actualReps: 6 }));
            expect(response.status).toBe(200);
        }
        const row = mocks.rows.get("execution");
        expect(row.completed_at).toBe(FIRST_COMPLETION);
        expect(row.action_executions[0].sets[0].completed_at).toBe(FIRST_ITEM_COMPLETION);
        expect(row.action_executions[0].sets[0].actual_reps).toBe(6);
        expect(progress()).toBe(7);
        expect(computeUsedCredits({ eligibleTrainingDayIndexSet: new Set([1, 4, 7]), executions: [row, later] })).toBe(2);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("keeps completion when toggling a historical habit off and on", async () => {
        mocks.rows.set("execution", execution({ action_executions: [{
            item_type: "HABIT", status: "completed", completed: true, completed_at: FIRST_ITEM_COMPLETION,
        }] }));
        for (const completed of [false, true, true]) {
            const response = await completeItem(request({ executionId: "execution", actionIndex: 0, itemType: "HABIT", completed }));
            expect(response.status).toBe(200);
            expect(mocks.rows.get("execution").status).toBe("completed");
            expect(mocks.rows.get("execution").completed_at).toBe(FIRST_COMPLETION);
        }
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("does not invent today's date for completed legacy rows with unknown completion time", async () => {
        mocks.rows.set("execution", execution({ completed_at: null }));
        expect((await completeSet(request({ executionId: "execution", actionIndex: 0, setIndex: 0 }))).status).toBe(200);
        expect(mocks.rows.get("execution").completed_at).toBeNull();
    });

    it.each(["abandoned", "timed_out"])("cannot silently turn %s into completed", async (status) => {
        mocks.rows.set("execution", execution({ status }));
        expect((await completeSet(request({ executionId: "execution", actionIndex: 0, setIndex: 0 }))).status).toBe(409);
        expect(mocks.rows.get("execution").status).toBe(status);
    });

    it("rejects a stale set update rather than overwriting another device's data", async () => {
        mocks.beforeUpdate = () => {
            const row = mocks.rows.get("execution");
            row.updated_at = "2026-09-26T00:00:00.000Z";
            row.action_executions[0].sets[0].notes = "other device";
        };
        const response = await completeSet(request({ executionId: "execution", actionIndex: 0, setIndex: 0, actionId: "action", actualWeight: 35, actualReps: 6 }));
        expect(response.status).toBe(409);
        expect(mocks.rows.get("execution").action_executions[0].sets[0].notes).toBe("other device");
        expect(mocks.autoE1RM).not.toHaveBeenCalled();
    });

    it("cannot revive a workout that times out while finish is in flight", async () => {
        mocks.rows.set("execution", execution({ status: "in_progress", completed_at: null, started_at: new Date().toISOString() }));
        mocks.beforeUpdate = () => Object.assign(mocks.rows.get("execution"), {
            status: "timed_out", updated_at: "2026-09-26T04:00:01.000Z",
        });
        expect((await finish(request({ executionId: "execution" }))).status).toBe(409);
        expect(mocks.rows.get("execution").status).toBe("timed_out");
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("does not accept an in-progress save after the five-hour boundary", async () => {
        mocks.rows.set("execution", execution({
            status: "in_progress", completed_at: null, started_at: "2026-09-25T23:00:00.000Z",
        }));
        expect((await completeSet(request({ executionId: "execution", actionIndex: 0, setIndex: 0 }))).status).toBe(409);
        expect(mocks.rows.get("execution").completed_at).toBeNull();
    });

    it("finish returns the winning completion when another request has already completed", async () => {
        const winningCompletion = "2026-09-26T03:59:59.000Z";
        mocks.rows.set("execution", execution({ status: "in_progress", completed_at: null, started_at: "2026-09-26T03:30:00.000Z" }));
        mocks.beforeUpdate = () => Object.assign(mocks.rows.get("execution"), {
            status: "completed", completed_at: winningCompletion, updated_at: winningCompletion,
        });
        const response = await finish(request({ executionId: "execution" }));
        expect(response.status).toBe(200);
        expect((await response.json()).data.completed_at).toBe(winningCompletion);
        expect(mocks.rows.get("execution").completed_at).toBe(winningCompletion);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });
});
