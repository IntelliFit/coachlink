/**
 * 自动托管闭环（消息与时序）：连发两条、AI 分身同时开着、草稿模式、7 天过期。
 * 全部离线，见 ./harness.ts。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", async () => (await import("./harness")).mockModules.supabaseClient());
vi.mock("@/lib/coachlinkLlm", async () => (await import("./harness")).mockModules.coachlinkLlm());
vi.mock("@/lib/getApiUserId", async () => (await import("./harness")).mockModules.getApiUserId());
vi.mock("@/lib/auth", async () => (await import("./harness")).mockModules.auth());
vi.mock("@/app/api/auth/[...nextauth]/auth", async () => (await import("./harness")).mockModules.nextAuth());
vi.mock("next/server", async (importOriginal) => (await import("./harness")).mockModules.nextServer(importOriginal));

import {
    IDS,
    activateSubscription,
    advanceDays,
    advanceMs,
    aiAutoReplies,
    coachToStudent,
    createGate,
    dumpWorld,
    expected,
    extraction,
    initialPlanJob,
    installSandbox,
    intakeState,
    llmCalls,
    planInstance,
    plannedSet,
    privateRoomId,
    repliesTo,
    resetWorld,
    runAfterTasks,
    startNextAfterTask,
    startTraining,
    studentPrs,
    studentSends,
    systemNotices,
    waitUntil,
    world,
} from "./harness";

const PRS_EXCEPT_SQUAT_AND_BENCH = [
    { actionId: IDS.deadlift, e1rm: 150 },
    { actionId: IDS.pullup, e1rm: 25 },
];
const prFor = (actionId: string) => studentPrs().filter((pr) => pr.action_id === actionId);
const intakeReplies = () => coachToStudent().filter((m) => m.content_metadata?.kind === "plan_intake_reply");

/** 按消息原文作答：深蹲/卧推的数字，以及“膝盖”之类的伤病。 */
function scriptedReply({ q, messages, questions }: { q: (name: string) => string; messages: string[]; questions: Array<{ id: string; action?: string }> }) {
    const text = messages.join("\n");
    const pending = new Set(questions.map((item) => item.action));
    const oneRmAnswers = [
        ...(pending.has("深蹲") && text.includes("深蹲") ? [{ questionId: q("深蹲"), weightKg: 100, reps: 5 }] : []),
        ...(pending.has("卧推") && text.includes("卧推") ? [{ questionId: q("卧推"), weightKg: 80, reps: 5 }] : []),
    ];
    return extraction({ oneRmAnswers, riskNotes: text.includes("膝盖") ? "右膝旧伤" : "" });
}

beforeEach(() => {
    installSandbox();
});

afterEach(() => {
    if (process.env.HARNESS_DUMP) dumpWorld();
    expect(world.fetchCalls).toEqual([]);
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("two messages sent within a second", () => {
    it("processes both messages in one extraction and sends one confirmation", async () => {
        resetWorld({ studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 } });
        world.llm.intakeReply = scriptedReply;
        await activateSubscription();

        await studentSends("深蹲100公斤5个");
        advanceMs(500);
        await studentSends("卧推80公斤5个");
        expect(world.afterQueue).toHaveLength(2);
        await runAfterTasks();

        expect(llmCalls("fast")).toHaveLength(1);
        expect(llmCalls("fast")[0].prompt).toContain("深蹲100公斤5个");
        expect(llmCalls("fast")[0].prompt).toContain("卧推80公斤5个");
        expect(intakeState().status).toBe("answered");
        expect(prFor(IDS.squat)).toHaveLength(1);
        expect(prFor(IDS.bench)).toHaveLength(1);
        expect(intakeReplies()).toHaveLength(1);
    });

    it("picks up a second message that arrives while the first is still at the model", async () => {
        resetWorld({ studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 } });
        world.llm.intakeReply = scriptedReply;
        const gate = createGate();
        world.llm.intakeGate = gate.wait;
        await activateSubscription();

        await studentSends("深蹲100公斤5个");
        const first = startNextAfterTask();
        await waitUntil(() => llmCalls("fast").length === 1, "first extraction");

        await studentSends("卧推80公斤5个");
        await runAfterTasks();
        world.llm.intakeGate = null;
        gate.open();
        await first;

        expect(llmCalls("fast")).toHaveLength(2);
        expect(intakeState().status).toBe("answered");
        expect(prFor(IDS.squat)).toHaveLength(1);
        expect(prFor(IDS.bench)).toHaveLength(1);
        expect(intakeReplies()).toHaveLength(2);
    });

    // BUG INTAKE-LATE-MESSAGE-DROPPED（见 bug 清单）：第一条把问题全答完、计划助理关闭时，
    // 处理期间到达的第二条（这里是伤病）被当成“已处理”，却没进任何模型，也没转告教练。
    // 修好后去掉 .fails。
    it.fails("BUG INTAKE-LATE-MESSAGE-DROPPED: a message that arrives while the first one closes the intake still gets handled", async () => {
        resetWorld({ studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 }, autoReplyEnabled: true });
        world.llm.intakeReply = scriptedReply;
        const gate = createGate();
        world.llm.intakeGate = gate.wait;
        await activateSubscription();

        await studentSends("深蹲100公斤5个，卧推80公斤5个");
        const first = startNextAfterTask();
        await waitUntil(() => llmCalls("fast").length === 1, "first extraction");

        await studentSends("对了，我右膝盖有旧伤");
        await runAfterTasks();
        world.llm.intakeGate = null;
        gate.open();
        await first;

        expect(intakeState().status).toBe("answered");
        expect(prFor(IDS.squat)).toHaveLength(1);
        const seenByModel = world.llmCalls.some((call) => call.prompt.includes("右膝盖有旧伤"));
        const toldCoach = systemNotices().some((m) => String(m.content).includes("膝"));
        expect(seenByModel || toldCoach).toBe(true);
    });
});

describe("subscription activated twice", () => {
    it("is idempotent when the second activation comes after the first finished", async () => {
        resetWorld({ studentProfile: { weight: 75 } });
        await activateSubscription();
        const again = await activateSubscription();

        expect(again).toMatchObject({ success: true });
        expect(world.db.rows("coach_plan_instances")).toHaveLength(1);
        expect(coachToStudent().map((m) => m.content_metadata?.kind)).toEqual(["plan_instance_created", "plan_intake_questions"]);
    });

    // BUG INITIAL-PLAN-DOUBLE-RUN（见 bug 清单）：两次激活同时进来（支付回调、轮询、返回页
    // 可能同时 finalize 订单），第二次拿到 running 的任务照样往下跑：两份计划、两条“计划已发放”、
    // 两条计划助理问题。修好后去掉 .fails。
    it.fails("BUG INITIAL-PLAN-DOUBLE-RUN: two concurrent activations create one plan and ask once", async () => {
        resetWorld({ studentProfile: { weight: 75 } });
        await Promise.all([activateSubscription(), activateSubscription()]);

        expect(world.db.rows("coach_plan_instances")).toHaveLength(1);
        expect(coachToStudent().map((m) => m.content_metadata?.kind)).toEqual(["plan_instance_created", "plan_intake_questions"]);
    });
});

describe("coach has AI auto-reply on", () => {
    it("sends exactly one reply per student message across the intake's lifetime", async () => {
        resetWorld({ studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 }, autoReplyEnabled: true });
        world.llm.intakeReply = ({ q, messages, questions }) => {
            const text = messages.join("\n");
            if (text.includes("周末")) return extraction({ related: false });
            return scriptedReply({ q, messages, questions });
        };
        await activateSubscription();

        // 1. 与问题无关：计划助理不接，AI 分身回一条。
        const { messageId: offTopic } = await studentSends("周末健身房不开门怎么办？");
        await runAfterTasks();
        expect(repliesTo(offTopic).map((m) => m.content_metadata?.kind ?? "ai")).toEqual(["ai"]);
        expect(intakeState().status).toBe("awaiting_reply");

        // 2. 回答问题：只有计划助理的确认，不再有 AI 分身。
        const { messageId: answer } = await studentSends("深蹲100公斤5个，卧推80公斤5个");
        await runAfterTasks();
        expect(repliesTo(answer).map((m) => m.content_metadata?.kind)).toEqual(["plan_intake_reply"]);
        expect(intakeState().status).toBe("answered");

        // 3. 关闭之后：直接由 AI 分身回复，不经过 after()。
        const { messageId: later } = await studentSends("好的，谢谢");
        expect(world.afterQueue).toHaveLength(0);
        expect(repliesTo(later).map((m) => m.content_metadata?.kind ?? "ai")).toEqual(["ai"]);

        expect(llmCalls("fast")).toHaveLength(2);
        expect(llmCalls("coachReply")).toHaveLength(2);
    });

    it("falls back to the AI reply when the extraction model fails, and re-reads the answer next time", async () => {
        resetWorld({ studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 }, autoReplyEnabled: true });
        let calls = 0;
        world.llm.intakeReply = (input) => {
            calls += 1;
            if (calls === 1) throw new Error("model timeout (scripted)");
            return scriptedReply(input);
        };
        await activateSubscription();

        const { messageId: first } = await studentSends("深蹲100公斤5个");
        await runAfterTasks();
        expect(repliesTo(first).map((m) => m.content_metadata?.kind ?? "ai")).toEqual(["ai"]);
        expect(intakeState()).toMatchObject({ status: "awaiting_reply", processing: null });

        const { messageId: second } = await studentSends("卧推80公斤5个");
        await runAfterTasks();
        expect(llmCalls("fast").at(-1)?.prompt).toContain("深蹲100公斤5个");
        expect(repliesTo(second).map((m) => m.content_metadata?.kind)).toEqual(["plan_intake_reply"]);
        expect(prFor(IDS.squat)).toHaveLength(1);
        expect(prFor(IDS.bench)).toHaveLength(1);
    });

    it("ignores the coach's own messages in the room", async () => {
        resetWorld({ studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 }, autoReplyEnabled: true });
        world.llm.intakeReply = scriptedReply;
        await activateSubscription();

        await studentSends("深蹲大概100公斤5个吧", IDS.coachUser);
        await runAfterTasks();
        expect(llmCalls("fast")).toHaveLength(0);
        expect(llmCalls("coachReply")).toHaveLength(0);
        expect(intakeState().status).toBe("awaiting_reply");
        expect(privateRoomId()).toBeTruthy();
    });
});

describe("draft mode", () => {
    it("asks the student while the coach reviews the draft, and the published plan uses the answers", async () => {
        resetWorld({ initialPlanMode: "draft", studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 } });
        world.llm.intakeReply = scriptedReply;

        expect(await activateSubscription()).toMatchObject({ success: true });
        const plan = planInstance();
        expect(plan.status).toBe("draft");
        expect(initialPlanJob()).toMatchObject({ status: "needs_coach_review", needs_coach_confirmation: true });

        // 草稿不通知学员“计划已发放”，只发计划助理的问题，并说明教练还在准备。
        const toStudent = coachToStudent();
        expect(toStudent.map((m) => m.content_metadata?.kind)).toEqual(["plan_intake_questions"]);
        expect(String(toStudent[0].content)).toContain("教练正在为你准备训练计划");
        const coachNotice = String(systemNotices().at(-1)?.content);
        expect(coachNotice).toContain("首个训练计划草稿");
        expect(coachNotice).toContain("计划助理已私信学员确认 2 项");

        await studentSends("深蹲100公斤5个，卧推80公斤5个");
        await runAfterTasks();
        expect(intakeState().status).toBe("answered");
        expect(initialPlanJob().status).toBe("needs_coach_review");

        // 草稿不能开始训练；教练发布后按学员的回答出公斤数。
        expect((await startTraining(plan.id, 1)).status).not.toBe(200);
        world.db.table("coach_plan_instances").find((row) => row.id === plan.id)!.status = "active";
        const day1 = await startTraining(plan.id, 1);
        expect(day1.status).toBe(200);
        expect(plannedSet(day1.json.data, IDS.squat).weight).toBe(expected.rmKg(expected.e1rm(100, 5), 5));
    });
});

describe("intake expiry after 7 days", () => {
    it("still handles a reply on day 6", async () => {
        resetWorld({ studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 } });
        world.llm.intakeReply = scriptedReply;
        await activateSubscription();

        advanceDays(6);
        await studentSends("深蹲100公斤5个，卧推80公斤5个");
        await runAfterTasks();
        expect(intakeState().status).toBe("answered");
        expect(prFor(IDS.squat)).toHaveLength(1);
    });

    it("stops treating messages as answers after 7 days and hands them to the AI reply", async () => {
        resetWorld({ studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 }, autoReplyEnabled: true });
        world.llm.intakeReply = scriptedReply;
        await activateSubscription();

        advanceDays(8);
        const { messageId } = await studentSends("深蹲100公斤5个，卧推80公斤5个");
        expect(world.afterQueue).toHaveLength(0);
        expect(llmCalls("fast")).toHaveLength(0);
        expect(studentPrs()).toEqual([
            expect.objectContaining({ action_id: IDS.deadlift }),
            expect.objectContaining({ action_id: IDS.pullup }),
        ]);
        expect(repliesTo(messageId).map((m) => m.content_metadata?.kind ?? "ai")).toEqual(["ai"]);
        expect(aiAutoReplies()).toHaveLength(1);
    });

    // bug 清单 INTAKE-EXPIRY-NOT-CLOSED：过期只在读取时判断，状态永远停在 awaiting_reply，
    // 教练也收不到“学员 7 天没回复”的提醒。
    it("current behavior: an expired intake keeps status awaiting_reply", async () => {
        resetWorld({ studentPrs: PRS_EXCEPT_SQUAT_AND_BENCH, studentProfile: { weight: 75 } });
        await activateSubscription();
        const noticesBefore = systemNotices().length;

        advanceDays(8);
        await studentSends("在吗");
        await runAfterTasks();
        expect(intakeState().status).toBe("awaiting_reply");
        expect(systemNotices()).toHaveLength(noticesBefore);
    });
});
