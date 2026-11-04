import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";
import { dayPrescriptionKey } from "./planDayLock";

const mocks = vi.hoisted(() => ({ store: {} as Record<string, any>, updates: [] as any[] }));

vi.mock("@/lib/supabaseClient", () => {
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        const s = mocks.store;
        if (ctx.table === "coach_plan_adjustment_drafts") {
            if (ctx.op === "update") return { data: { ...s.draft, ...ctx.payload }, error: null };
            return { data: s.draft, error: null };
        }
        if (ctx.table === "coaches") return { data: { user_id: "coach-user-1" }, error: null };
        if (ctx.table === "coach_plan_instances") {
            if (ctx.op === "update") {
                mocks.updates.push(ctx.payload);
                return { data: null, error: null };
            }
            return { data: s.plan, error: null };
        }
        if (ctx.table === "plan_instance_executions") return { data: s.executions, error: null };
        return { data: null, error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("@/lib/chat", () => ({ sendSystemMessage: vi.fn() }));

import { applyAdjustmentDraft } from "./feedback";

const day = (dayIndex: number, sets: number) => ({
    type: "training",
    dayIndex,
    actionSets: [{ type: "no-filter", actionId: "squat", params: { 组数: sets, 次数: 5, 强度: 5 } }],
});

beforeEach(() => {
    mocks.updates.length = 0;
    const base = [day(1, 5), day(2, 5), day(3, 5)];
    mocks.store = {
        plan: { training_days: [day(1, 5), day(2, 5), day(3, 6)], start_execution_day: 1 },
        executions: [{ day_index: 1, status: "completed" }],
        draft: {
            id: "draft-1",
            coach_id: "coach-1",
            plan_instance_id: "plan-1",
            status: "draft",
            job_id: null,
            proposed_patch: {
                updatedTrainingDays: [day(1, 3), day(2, 3), day(3, 5)],
                baseDayKeys: base.map(dayPrescriptionKey),
            },
        },
    };
});

describe("applyAdjustmentDraft", () => {
    it("keeps days trained after the draft was made and the coach's later edits", async () => {
        await applyAdjustmentDraft("draft-1", "coach-user-1");

        const written = mocks.updates[0].training_days;
        expect(written[0].actionSets[0].params.组数).toBe(5);
        expect(written[1].actionSets[0].params.组数).toBe(3);
        expect(written[2].actionSets[0].params.组数).toBe(6);
    });

    it("refuses a draft whose day count no longer matches the plan", async () => {
        mocks.store.plan.training_days = [day(1, 5), day(2, 5)];
        await expect(applyAdjustmentDraft("draft-1", "coach-user-1")).rejects.toThrow("draft_stale_day_count_changed");
        expect(mocks.updates).toHaveLength(0);
    });

    it("still applies older drafts without base keys, except locked days", async () => {
        delete mocks.store.draft.proposed_patch.baseDayKeys;
        await applyAdjustmentDraft("draft-1", "coach-user-1");
        const written = mocks.updates[0].training_days;
        expect(written.map((d: any) => d.actionSets[0].params.组数)).toEqual([5, 3, 5]);
    });

    it("rejects other coaches", async () => {
        await expect(applyAdjustmentDraft("draft-1", "someone-else")).rejects.toThrow("forbidden");
    });
});
