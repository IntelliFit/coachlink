import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const mocks = vi.hoisted(() => ({
    store: {} as Record<string, any>,
    personalize: vi.fn(),
    current1RM: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => {
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        const s = mocks.store;
        if (ctx.table === "coach_plan_instances") return { data: s.plan, error: null };
        if (ctx.table === "coach_subscriptions") return { data: { subscribe_data: [], subscribed_weeks: 4 }, error: null };
        if (ctx.table === "user_profiles") return { data: { nickname: "小王", weight: 70 }, error: null };
        if (ctx.table === "coach_actions") return { data: s.actions, error: null };
        if (ctx.table === "plan_instance_executions") return { data: s.executions, error: null };
        if (ctx.table === "coach_plan_adjustment_drafts" && ctx.op === "insert") {
            s.draft = ctx.payload;
            return { data: { id: "draft-1" }, error: null };
        }
        return { data: null, error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("@/app/api/plan-lib/ai-personalize-plan/personalize-plan", () => ({
    personalizePlanWithLLM: mocks.personalize,
}));

vi.mock("@/app/api/student/get-current-1rm/route", () => ({
    getCurrent1RMRecords: mocks.current1RM,
}));

import { draftPlanRevisionFromIntake } from "./planIntakeRevision";

const set = (actionId: string, params: Record<string, unknown>) => ({ type: "no-filter", actionId, setName: actionId, params });
const baseParams = {
    planInstanceId: "plan-1",
    subscriptionId: "sub-1",
    coachId: "coach-1",
    coachUserId: "coach-user-1",
    studentId: "student-1",
    intakeJobId: "job-1",
    notes: ["家里有单杠吗？ → 只有哑铃，没有单杠"],
    riskNotes: [],
};

beforeEach(() => {
    mocks.personalize.mockReset();
    mocks.current1RM.mockReset().mockResolvedValue([]);
    mocks.store = {
        plan: {
            id: "plan-1",
            name: "小王的计划",
            status: "active",
            coach_subscription_id: "sub-1",
            start_execution_day: 1,
            training_days: [
                { type: "training", dayIndex: 1, actionSets: [set("pull", { 组数: 4, 次数: 5, 强度: 5 })] },
                { type: "training", dayIndex: 2, actionSets: [set("pull", { 组数: 4, 次数: 5, 强度: 5 })] },
            ],
        },
        actions: [
            { id: "pull", name: "引体向上", type: "STRENGTH" },
            { id: "row", name: "哑铃划船", type: "STRENGTH" },
        ],
        executions: [{ day_index: 1, status: "completed" }],
        draft: null,
    };
});

describe("draftPlanRevisionFromIntake", () => {
    it("drafts a revision that only changes untrained days and passes the notes to the model", async () => {
        mocks.personalize.mockResolvedValue({
            trainingDays: [
                { type: "training", dayIndex: 1, actionSets: [set("row", { 组数: 4, 次数: 8, 强度: 8 })] },
                { type: "training", dayIndex: 2, actionSets: [set("row", { 组数: 4, 次数: 8, 强度: 8 })] },
            ],
            reasoning: "",
            changesSummary: "没有单杠，引体换成哑铃划船",
        });

        const result = await draftPlanRevisionFromIntake(baseParams);

        expect(result).toEqual({ status: "drafted", draftId: "draft-1", summary: "按学员私信补充调整：没有单杠，引体换成哑铃划船" });
        const prompt = mocks.personalize.mock.calls[0][0];
        expect(prompt.questionnaireAnswers.at(-1)).toMatchObject({ type: "text", userSelection: "- 家里有单杠吗？ → 只有哑铃，没有单杠" });
        expect(prompt.selectedTemplate.training_days).toBe(mocks.store.plan.training_days);
        expect(mocks.current1RM).toHaveBeenCalledWith("coach-user-1", { targetUserId: "student-1" });

        const draft = mocks.store.draft;
        expect(draft).toMatchObject({ job_id: null, status: "draft", requires_coach_review: true, risk_level: "medium" });
        expect(draft.proposed_patch.updatedTrainingDays[0]).toBe(mocks.store.plan.training_days[0]);
        expect(draft.proposed_patch.updatedTrainingDays[1].actionSets[0].actionId).toBe("row");
        expect(draft.proposed_patch.baseDayKeys).toHaveLength(2);
        expect(draft.proposed_patch.lockedDayIndexes).toEqual([1]);
    });

    it("marks injury-driven drafts high risk", async () => {
        mocks.personalize.mockResolvedValue({
            trainingDays: [
                { type: "training", dayIndex: 1, actionSets: [set("pull", { 组数: 4, 次数: 5, 强度: 5 })] },
                { type: "training", dayIndex: 2, actionSets: [set("pull", { 组数: 3, 次数: 5, 强度: 7 })] },
            ],
            reasoning: "",
            changesSummary: "降量",
        });
        await draftPlanRevisionFromIntake({ ...baseParams, notes: [], riskNotes: ["左肩做引体会疼"] });
        expect(mocks.store.draft.risk_level).toBe("high");
        expect(mocks.personalize.mock.calls[0][0].questionnaireAnswers.at(-1).userSelection).toContain("身体情况：左肩做引体会疼");
    });

    it("skips when nothing changes, the day count changes, or the plan is finished", async () => {
        mocks.personalize.mockResolvedValue({ trainingDays: mocks.store.plan.training_days, reasoning: "", changesSummary: "" });
        expect(await draftPlanRevisionFromIntake(baseParams)).toEqual({ status: "skipped", reason: "no_change" });

        mocks.personalize.mockResolvedValue({ trainingDays: mocks.store.plan.training_days.slice(0, 1), reasoning: "", changesSummary: "" });
        expect(await draftPlanRevisionFromIntake(baseParams)).toEqual({ status: "skipped", reason: "day_count_changed" });

        mocks.store.plan.status = "completed";
        expect(await draftPlanRevisionFromIntake(baseParams)).toEqual({ status: "skipped", reason: "plan_not_revisable" });
        expect(await draftPlanRevisionFromIntake({ ...baseParams, notes: [] })).toEqual({ status: "skipped", reason: "no_notes" });
        expect(mocks.store.draft).toBeNull();
    });
});
