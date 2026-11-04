import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const COACH_USER = "coach-user-1";
const COACH_ID = "coach-1";
const STUDENT = "student-1";
const PLAN_ID = "plan-1";
const ROOM_ID = "room-1";

const mocks = vi.hoisted(() => ({
    store: {} as Record<string, any>,
    contexts: [] as any[],
    sendDirectMessage: vi.fn(),
    sendSystemMessage: vi.fn(),
    llmCreate: vi.fn(),
    current1RM: vi.fn(),
}));

function filterValue(ctx: SupabaseExecContext, kind: string, column: string) {
    return ctx.filters.find((f) => f.kind === kind && f.args[0] === column)?.args[1];
}

vi.mock("@/lib/supabaseClient", () => {
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        mocks.contexts.push(ctx);
        const s = mocks.store;
        if (ctx.table === "coach_automation_jobs") {
            if (ctx.op === "select") return { data: s.job ? [s.job] : [], error: null };
            if (ctx.op === "update") {
                if (!s.job || filterValue(ctx, "eq", "updated_at") !== s.job.updated_at) return { data: [], error: null };
                s.job = { ...s.job, ...ctx.payload };
                return { data: [s.job], error: null };
            }
        }
        if (ctx.table === "coaches") {
            return { data: filterValue(ctx, "eq", "user_id") === COACH_USER ? { id: COACH_ID, user_id: COACH_USER, name: "李" } : { name: "李" }, error: null };
        }
        if (ctx.table === "coach_plan_instances") return { data: s.plan, error: null };
        if (ctx.table === "user_profiles") {
            if (ctx.op === "update") {
                s.profile = { ...s.profile, ...ctx.payload };
                return { data: null, error: null };
            }
            return { data: s.profile, error: null };
        }
        if (ctx.table === "coach_subscriptions") return { data: { subscribe_data: [] }, error: null };
        if (ctx.table === "coach_actions") return { data: s.actions, error: null };
        if (ctx.table === "chat_messages") {
            const since = filterValue(ctx, "gt", "created_at");
            return { data: (s.messages || []).filter((m: any) => !since || m.created_at > since), error: null };
        }
        if (ctx.table === "personal_records_history") {
            s.prRows = [...(s.prRows || []), ...ctx.payload];
            return { data: null, error: null };
        }
        return { data: null, error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("@/lib/chat", () => ({
    sendDirectMessage: mocks.sendDirectMessage,
    sendSystemMessage: mocks.sendSystemMessage,
}));

vi.mock("@/lib/coachlinkLlm", () => ({
    getCoachlinkFastLlm: () => ({ client: { chat: { completions: { create: mocks.llmCreate } } }, model: "fast" }),
}));

vi.mock("@/app/api/student/get-current-1rm/route", () => ({
    getCurrent1RMRecords: mocks.current1RM,
}));

import { handlePlanIntakeReply, hasAwaitingPlanIntake, startPlanIntake } from "./planIntake";

const context = { subscriptionId: "sub-1", coachId: COACH_ID, studentId: STUDENT, coachUserId: COACH_USER };

function llmReturns(payload: unknown) {
    mocks.llmCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(payload) } }] });
}

function replyParams(content: string) {
    return {
        roomId: ROOM_ID,
        roomMembers: [STUDENT, COACH_USER],
        senderUserId: STUDENT,
        messageType: "text",
        content,
        messageId: "msg-9",
    };
}

beforeEach(() => {
    mocks.contexts.length = 0;
    mocks.sendDirectMessage.mockReset().mockResolvedValue(true);
    mocks.sendSystemMessage.mockReset().mockResolvedValue(true);
    mocks.llmCreate.mockReset();
    mocks.current1RM.mockReset().mockResolvedValue([
        { actionId: "bench", actionName: "卧推", current1RM: 100 },
    ]);
    mocks.store = {
        plan: {
            id: PLAN_ID,
            start_execution_day: 1,
            ai_generation_log: { stageB: { openQuestions: ["家里有单杠吗？"] } },
            training_days: [{
                type: "training",
                dayIndex: 1,
                actionSets: [
                    { type: "no-filter", actionId: "bench", params: { 强度: 5 } },
                    { type: "no-filter", actionId: "pull", params: { 强度: 3 } },
                ],
            }],
        },
        profile: { nickname: "小王", weight: null, sport_cards: null },
        actions: [
            { id: "bench", name: "卧推", type: "STRENGTH", includesBodyWeight: false },
            { id: "pull", name: "负重引体", type: "STRENGTH", includesBodyWeight: true },
        ],
        messages: [],
        prRows: [],
        job: null,
    };
});

describe("startPlanIntake", () => {
    it("asks for missing body weight, unknown lifts and open questions in one assistant DM", async () => {
        const state = await startPlanIntake({ context, planInstanceId: PLAN_ID, planPublished: true });

        expect(state.status).toBe("awaiting_reply");
        expect(state.questions.map((q) => q.id)).toEqual(["body_weight", "one_rm:pull", "open:0"]);
        expect(mocks.current1RM).toHaveBeenCalledWith(COACH_USER, { targetUserId: STUDENT });
        expect(mocks.sendDirectMessage).toHaveBeenCalledTimes(1);
        const dm = mocks.sendDirectMessage.mock.calls[0][0];
        expect(dm.fromUserId).toBe(COACH_USER);
        expect(dm.toUserId).toBe(STUDENT);
        expect(dm.content).toContain("计划助理（AI）");
        expect(dm.content).not.toContain("卧推");
        expect(dm.contentMetadata).toMatchObject({ kind: "plan_intake_questions", coach_ai_auto_reply: true });
    });

    it("sends nothing when every lift already has a 1RM and body weight is known", async () => {
        mocks.store.profile.weight = 70;
        mocks.store.plan.ai_generation_log = null;
        mocks.current1RM.mockResolvedValue([
            { actionId: "bench", actionName: "卧推", current1RM: 100 },
            { actionId: "pull", actionName: "负重引体", current1RM: 30 },
        ]);
        const state = await startPlanIntake({ context, planInstanceId: PLAN_ID, planPublished: true });
        expect(state.status).toBe("not_needed");
        expect(mocks.sendDirectMessage).not.toHaveBeenCalled();
    });
});

describe("handlePlanIntakeReply", () => {
    async function seedAwaitingJob() {
        const intake = await startPlanIntake({ context, planInstanceId: PLAN_ID, planPublished: true });
        mocks.sendDirectMessage.mockClear();
        mocks.store.job = {
            id: "job-1",
            updated_at: "2026-11-04T05:00:00.000+00:00",
            plan_instance_id: PLAN_ID,
            output_snapshot: { planId: PLAN_ID, intake },
        };
        mocks.store.messages = [{ content: "体重75，负重引体挂20公斤能做3个，家里有门框单杠", created_at: new Date(Date.now() + 1000).toISOString() }];
    }

    it("records the numbers, confirms to the student, tells the coach and closes the intake", async () => {
        await seedAwaitingJob();
        llmReturns({
            related: true,
            bodyWeightKg: 75,
            oneRmAnswers: [{ questionId: "one_rm:pull", weightKg: 20, reps: 3 }],
            openAnswers: [{ questionId: "open:0", answer: "有门框单杠" }],
            unknownQuestionIds: [],
            riskNotes: "",
            otherNotes: "",
        });

        const result = await handlePlanIntakeReply(replyParams("体重75，负重引体挂20公斤能做3个，家里有门框单杠"));

        expect(result).toEqual({ handled: true });
        expect(mocks.store.profile.weight).toBe(75);
        expect(mocks.store.prRows).toHaveLength(1);
        expect(mocks.store.prRows[0]).toMatchObject({
            user_id: STUDENT,
            action_id: "pull",
            exercise_name: "负重引体",
            weight: 20,
            reps: 3,
            source_type: "coach",
            source_coach_id: COACH_ID,
        });
        expect(mocks.store.prRows[0].e1rm).toBeGreaterThan(25);
        const intake = mocks.store.job.output_snapshot.intake;
        expect(intake.status).toBe("answered");
        expect(intake.processing).toBeNull();
        expect(intake.pendingQuestionIds).toEqual([]);
        expect(mocks.sendDirectMessage).toHaveBeenCalledTimes(1);
        expect(mocks.sendDirectMessage.mock.calls[0][0].content).toContain("已记录：体重 75kg；负重引体 20kg×3");
        expect(mocks.sendSystemMessage).toHaveBeenCalledWith(COACH_USER, expect.objectContaining({
            content: expect.stringContaining("家里有单杠吗？ → 有门框单杠"),
        }));
    });

    it("holds a bodyweight-lift answer until the weight arrives and asks once more", async () => {
        await seedAwaitingJob();
        llmReturns({ related: true, oneRmAnswers: [{ questionId: "one_rm:pull", weightKg: 20, reps: 3 }] });

        const result = await handlePlanIntakeReply(replyParams("负重引体挂20能做3个"));

        expect(result).toEqual({ handled: true });
        expect(mocks.store.prRows).toHaveLength(0);
        const intake = mocks.store.job.output_snapshot.intake;
        expect(intake.status).toBe("awaiting_reply");
        expect(intake.followUpsSent).toBe(1);
        expect(intake.heldAnswers).toEqual([{ questionId: "one_rm:pull", weightKg: 20, reps: 3 }]);
        expect(intake.pendingQuestionIds).toEqual(["body_weight", "open:0"]);
        expect(mocks.sendDirectMessage.mock.calls[0][0].content).toContain("1. 你现在的体重大概多少公斤？");
    });

    it("flags pain for the coach instead of changing anything", async () => {
        await seedAwaitingJob();
        llmReturns({ related: true, bodyWeightKg: 70, riskNotes: "左肩做引体会疼" });

        await handlePlanIntakeReply(replyParams("体重70，左肩做引体会疼"));

        expect(mocks.store.job.needs_coach_confirmation).toBe(true);
        expect(mocks.sendSystemMessage.mock.calls[0][1].content).toContain("⚠ 提到身体问题：左肩做引体会疼");
        expect(mocks.sendDirectMessage.mock.calls[0][0].content).toContain("先别硬练");
    });

    it("leaves unrelated chat to the normal auto-reply", async () => {
        await seedAwaitingJob();
        llmReturns({ related: false });

        const result = await handlePlanIntakeReply(replyParams("教练你好"));

        expect(result).toEqual({ handled: false });
        expect(mocks.sendDirectMessage).not.toHaveBeenCalled();
        const intake = mocks.store.job.output_snapshot.intake;
        expect(intake.status).toBe("awaiting_reply");
        expect(intake.processing).toBeNull();
    });

    it("does nothing without an awaiting intake", async () => {
        expect(await handlePlanIntakeReply(replyParams("体重70"))).toEqual({ handled: false });
        expect(await hasAwaitingPlanIntake(replyParams("体重70"))).toBe(false);
        await seedAwaitingJob();
        expect(await hasAwaitingPlanIntake(replyParams("体重70"))).toBe(true);
    });

    it("treats a split message as handled while the first one is being processed", async () => {
        await seedAwaitingJob();
        mocks.store.job.output_snapshot.intake.processing = { messageId: "msg-8", at: new Date().toISOString() };
        expect(await handlePlanIntakeReply(replyParams("体重70"))).toEqual({ handled: true });
        expect(mocks.llmCreate).not.toHaveBeenCalled();
    });

    it("picks up a message that arrived during processing in a second pass", async () => {
        await seedAwaitingJob();
        const responses = [
            { related: true, oneRmAnswers: [{ questionId: "one_rm:pull", weightKg: 20, reps: 3 }] },
            { related: true, bodyWeightKg: 75 },
        ];
        let calls = 0;
        mocks.llmCreate.mockImplementation(async () => {
            if (calls === 0) {
                mocks.store.messages.push({ content: "体重75", created_at: new Date(Date.now() + 5000).toISOString() });
            }
            return { choices: [{ message: { content: JSON.stringify(responses[calls++]) } }] };
        });

        const result = await handlePlanIntakeReply(replyParams("负重引体挂20能做3个"));

        expect(result).toEqual({ handled: true });
        expect(mocks.llmCreate).toHaveBeenCalledTimes(2);
        expect(mocks.store.prRows).toHaveLength(1);
        expect(mocks.store.prRows[0]).toMatchObject({ action_id: "pull", weight: 20, reps: 3 });
        expect(mocks.store.profile.weight).toBe(75);
    });

    it("passes high-rep answers to the coach instead of recording a 1RM", async () => {
        await seedAwaitingJob();
        llmReturns({ related: true, bodyWeightKg: 70, oneRmAnswers: [{ questionId: "one_rm:pull", weightKg: 0, reps: 25 }] });

        await handlePlanIntakeReply(replyParams("体重70，自重引体能做25个"));

        expect(mocks.store.prRows).toHaveLength(0);
        expect(mocks.sendSystemMessage.mock.calls[0][1].content).toContain("负重引体 0kg×25，次数太多，没折算 1RM");
        expect(mocks.store.job.output_snapshot.intake.pendingQuestionIds).not.toContain("one_rm:pull");
    });

    it("does not ask for body weight again when the student says they do not know it", async () => {
        await seedAwaitingJob();
        llmReturns({ related: true, unknownQuestionIds: ["body_weight"], oneRmAnswers: [{ questionId: "one_rm:pull", weightKg: 20, reps: 3 }] });

        await handlePlanIntakeReply(replyParams("体重不清楚，负重引体挂20能做3个"));

        const intake = mocks.store.job.output_snapshot.intake;
        expect(intake.heldAnswers).toEqual([]);
        expect(intake.pendingQuestionIds).toEqual(["open:0"]);
        expect(mocks.sendSystemMessage.mock.calls[0][1].content).toContain("缺体重，没折算 1RM");
    });

    it("saves state before writing data, so a lost race writes nothing", async () => {
        await seedAwaitingJob();
        mocks.llmCreate.mockImplementationOnce(async () => {
            mocks.store.job = { ...mocks.store.job, updated_at: "2099-01-01T00:00:00.000+00:00" };
            return { choices: [{ message: { content: JSON.stringify({ related: true, bodyWeightKg: 75 }) } }] };
        });

        expect(await handlePlanIntakeReply(replyParams("体重75"))).toEqual({ handled: true });
        expect(mocks.store.profile.weight).toBeNull();
        expect(mocks.sendDirectMessage).not.toHaveBeenCalled();
    });

    it("ignores messages the coach sends and rooms that are not one-to-one", async () => {
        await seedAwaitingJob();
        expect(await handlePlanIntakeReply({ ...replyParams("体重70"), senderUserId: COACH_USER })).toEqual({ handled: false });
        expect(await handlePlanIntakeReply({ ...replyParams("体重70"), roomMembers: [STUDENT, COACH_USER, "x"] })).toEqual({ handled: false });
        expect(mocks.llmCreate).not.toHaveBeenCalled();
    });
});
