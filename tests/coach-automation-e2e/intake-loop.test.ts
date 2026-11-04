/**
 * 自动托管闭环（数据链路）：订阅生效 → 首个计划 → 计划助理私信 → 学员回复 →
 * PR/体重入库 → 开始训练与计划页按新 1RM 出公斤数。全部离线，见 ./harness.ts。
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
    buildTrainingDays,
    coachToStudent,
    dumpWorld,
    expected,
    extraction,
    getInstance,
    initialPlanJob,
    installSandbox,
    intakeState,
    llmCalls,
    planInstance,
    planLoad,
    plannedSet,
    resetWorld,
    runAfterTasks,
    startTraining,
    studentPrs,
    studentProfile,
    studentSends,
    systemNotices,
    world,
} from "./harness";

const ALL_PRS = [
    { actionId: IDS.squat, e1rm: 120 },
    { actionId: IDS.bench, e1rm: 90 },
    { actionId: IDS.deadlift, e1rm: 150 },
    { actionId: IDS.pullup, e1rm: 25 },
];
const withoutPr = (...actionIds: string[]) => ALL_PRS.filter((pr) => !actionIds.includes(pr.actionId));
const questionIds = () => (intakeState()?.questions || []).map((q: any) => q.id).sort();
const oneRmQuestion = (actionId: string) => `one_rm:${actionId}`;
const lastCoachNotice = () => String(systemNotices().at(-1)?.content || "");
const prFor = (actionId: string) => studentPrs().filter((pr) => pr.action_id === actionId);
const storedLoad = (plan: any, dayIndex: number, actionId: string) =>
    plan.training_days.find((d: any) => d.dayIndex === dayIndex)?.actionSets.find((s: any) => s.actionId === actionId)?.params?.load;

function seedOldIntakeJob(askedAt: string, intake: Record<string, unknown> = {}) {
    world.db.seed("coach_automation_jobs", [{
        type: "initial_plan",
        status: "succeeded",
        idempotency_key: `initial_plan:${IDS.oldSubscription}`,
        trigger_source: "subscription_activated",
        coach_id: IDS.coach,
        student_id: IDS.student,
        subscription_id: IDS.oldSubscription,
        created_at: askedAt,
        updated_at: askedAt,
        output_snapshot: {
            intake: {
                version: 1,
                status: "awaiting_reply",
                planInstanceId: null,
                askedAt,
                questions: [{ id: oneRmQuestion(IDS.squat), kind: "one_rm", prompt: "深蹲？", actionId: IDS.squat, actionName: "深蹲", includesBodyWeight: false }],
                pendingQuestionIds: [oneRmQuestion(IDS.squat)],
                answeredQuestionIds: [],
                unknownQuestionIds: [],
                heldAnswers: [],
                followUpsSent: 0,
                lastProcessedMessageAt: askedAt,
                recorded: [],
                notes: [],
                riskNotes: [],
                ...intake,
            },
        },
    }]);
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

describe("new student with no 1RMs", () => {
    it("asks for the missing 1RMs and bodyweight, records the reply, and the next training shows kg", async () => {
        resetWorld();
        world.llm.intakeReply = ({ q }) => extraction({
            bodyWeightKg: 75,
            oneRmAnswers: [
                { questionId: q("深蹲"), weightKg: 100, reps: 5 },
                { questionId: q("卧推"), weightKg: 80, reps: 5 },
                { questionId: q("硬拉"), weightKg: 140, reps: 3 },
                { questionId: q("负重引体"), weightKg: 20, reps: 5 },
            ],
        });

        expect(await activateSubscription()).toMatchObject({ success: true });
        const plan = planInstance();
        expect(plan.status).toBe("active");
        expect(plan.ai_generation_log?.fallback).toBeUndefined();
        expect(llmCalls("plan").length).toBeGreaterThanOrEqual(2);

        expect(coachToStudent().map((m) => m.content_metadata?.kind)).toEqual(["plan_instance_created", "plan_intake_questions"]);
        expect(intakeState().status).toBe("awaiting_reply");
        expect(questionIds()).toEqual(["body_weight", ...[IDS.squat, IDS.bench, IDS.deadlift, IDS.pullup].map(oneRmQuestion)].sort());
        expect(initialPlanJob().status).toBe("succeeded");
        expect(lastCoachNotice()).toContain("计划助理已私信学员确认 5 项");

        // 回复之前，计划页只有相对强度，没有公斤数。
        const before = await getInstance(plan.id);
        expect(planLoad(before.json.data.instance, 1, IDS.squat)).toMatchObject({ load: null });

        await studentSends("深蹲100公斤5个，卧推80做5个，硬拉140三个，引体加20公斤5个，体重75");
        expect(world.afterQueue).toHaveLength(1);
        await runAfterTasks();

        expect(intakeState().status).toBe("answered");
        expect(studentProfile().weight).toBe(75);
        expect(prFor(IDS.squat).map((pr) => pr.e1rm)).toEqual([expected.e1rm(100, 5)]);
        expect(prFor(IDS.bench).map((pr) => pr.e1rm)).toEqual([expected.e1rm(80, 5)]);
        expect(prFor(IDS.deadlift).map((pr) => pr.e1rm)).toEqual([expected.e1rm(140, 3)]);
        expect(prFor(IDS.pullup).map((pr) => pr.e1rm)).toEqual([expected.e1rm(20, 5, 75)]);
        expect(studentPrs().every((pr) => pr.source_coach_id === IDS.coach && pr.estimated_from?.source === "plan_intake")).toBe(true);

        expect(coachToStudent().slice(2).map((m) => m.content_metadata?.kind)).toEqual(["plan_intake_reply"]);
        expect(lastCoachNotice()).toContain("已记录：体重 75kg");

        const day1 = await startTraining(plan.id, 1);
        expect(day1.status).toBe(200);
        // 有公斤数时强度仍带单位（回归：曾显示成“102.5kg · 5次 · 5”）。
        expect(plannedSet(day1.json.data, IDS.squat)).toEqual({ weight: expected.rmKg(expected.e1rm(100, 5), 5), intensity: "5RM" });
        expect(plannedSet(day1.json.data, IDS.bench).weight).toBe(expected.pctKg(expected.e1rm(80, 5), 75));

        // 计划页与开始训练同一口径。
        const view = (await getInstance(plan.id)).json.data.instance;
        expect(planLoad(view, 1, IDS.squat).load).toBe(expected.rmLoad(expected.e1rm(100, 5), 5));
        expect(planLoad(view, 3, IDS.pullup).load).toBe(expected.rmLoad(expected.e1rm(20, 5, 75), 5, 75));
    });

    it("still asks and records when the plan model fails and the rule-match fallback builds the plan", async () => {
        resetWorld({ studentPrs: withoutPr(IDS.squat), studentProfile: { weight: 80 } });
        world.llm.planScript = null;
        world.llm.intakeReply = ({ q }) => extraction({ oneRmAnswers: [{ questionId: q("深蹲"), weightKg: 110, reps: 3 }] });

        expect(await activateSubscription()).toMatchObject({ success: true });
        const plan = planInstance();
        expect(plan.ai_generation_log?.fallback?.mode).toBe("rule_match");
        expect(questionIds()).toEqual([oneRmQuestion(IDS.squat)]);

        await studentSends("深蹲 110 做 3 个");
        await runAfterTasks();

        const day1 = await startTraining(plan.id, 1);
        expect(plannedSet(day1.json.data, IDS.squat).weight).toBe(expected.rmKg(expected.e1rm(110, 3), 5));
    });
});

describe("1RMs from the profile sport card only", () => {
    it("uses the card lifts without asking, asks only what the card lacks, and keeps the card loads", async () => {
        resetWorld({ studentProfile: { sport_cards: { powerlifting: { squat: 140, bench: 100, deadlift: 180 } } } });
        world.llm.intakeReply = ({ q }) => extraction({
            bodyWeightKg: 70,
            oneRmAnswers: [{ questionId: q("负重引体"), weightKg: 0, reps: 8 }],
        });

        await activateSubscription();
        const plan = planInstance();
        expect(questionIds()).toEqual(["body_weight", oneRmQuestion(IDS.pullup)]);
        expect(storedLoad(plan, 1, IDS.squat)).toBe(expected.rmLoad(140, 5));

        await studentSends("体重70，引体自重能做8个");
        await runAfterTasks();
        expect(intakeState().status).toBe("answered");
        expect(prFor(IDS.pullup).map((pr) => pr.e1rm)).toEqual([expected.e1rm(0, 8, 70)]);

        const day1 = await startTraining(plan.id, 1);
        expect(plannedSet(day1.json.data, IDS.squat).weight).toBe(expected.rmKg(140, 5));
        expect(plannedSet(day1.json.data, IDS.bench).weight).toBe(expected.pctKg(100, 75));

        const view = (await getInstance(plan.id)).json.data.instance;
        expect(planLoad(view, 3, IDS.deadlift).load).toBe(expected.rmLoad(180, 5));
        expect(planLoad(view, 3, IDS.pullup).load).toBe(expected.rmLoad(expected.e1rm(0, 8, 70), 5, 70));
    });
});

describe("bodyweight lift with missing bodyweight", () => {
    it("holds the pull-up answer, asks for bodyweight once, and records the 1RM after the second message", async () => {
        resetWorld({ studentPrs: withoutPr(IDS.pullup) });
        world.llm.intakeReply = ({ q, messages }) => {
            if (messages.some((m) => m.includes("68"))) return extraction({ bodyWeightKg: 68 });
            return extraction({ oneRmAnswers: [{ questionId: q("负重引体"), weightKg: 10, reps: 6 }] });
        };

        await activateSubscription();
        const plan = planInstance();
        expect(questionIds()).toEqual(["body_weight", oneRmQuestion(IDS.pullup)]);

        await studentSends("引体加10公斤能做6个");
        await runAfterTasks();
        let intake = intakeState();
        expect(intake.status).toBe("awaiting_reply");
        expect(intake.pendingQuestionIds).toEqual(["body_weight"]);
        expect(intake.heldAnswers).toEqual([{ questionId: oneRmQuestion(IDS.pullup), weightKg: 10, reps: 6 }]);
        expect(prFor(IDS.pullup)).toEqual([]);
        const followUp = String(coachToStudent().at(-1)?.content);
        expect(followUp).toContain("还差这几项");
        expect(followUp).toContain("体重");

        await studentSends("68公斤");
        await runAfterTasks();
        intake = intakeState();
        expect(intake.status).toBe("answered");
        expect(studentProfile().weight).toBe(68);
        expect(prFor(IDS.pullup).map((pr) => pr.e1rm)).toEqual([expected.e1rm(10, 6, 68)]);
        expect(prFor(IDS.pullup)[0].estimated_from).toMatchObject({ weight: 10, reps: 6, bodyWeight: 68 });

        const view = (await getInstance(plan.id)).json.data.instance;
        expect(planLoad(view, 3, IDS.pullup).load).toBe(expected.rmLoad(expected.e1rm(10, 6, 68), 5, 68));
        expect(coachToStudent().filter((m) => m.content_metadata?.kind === "plan_intake_reply")).toHaveLength(2);
    });
});

describe("student answers one question per message", () => {
    // BUG INTAKE-CLOSES-WHILE-ANSWERING（见 bug 清单）：追问一次（MAX_FOLLOW_UPS=1）后，
    // 下一条只答了一部分就关闭计划助理，学员接着发来的最后一项被丢掉。修好后去掉 .fails。
    it.fails("BUG INTAKE-CLOSES-WHILE-ANSWERING: records the last answer that comes after the follow-up", async () => {
        resetWorld({ studentPrs: [{ actionId: IDS.pullup, e1rm: 25 }], studentProfile: { weight: 75 } });
        world.llm.intakeReply = ({ q, messages }) => {
            const text = messages.join("\n");
            return extraction({
                oneRmAnswers: [
                    ...(text.includes("深蹲") ? [{ questionId: q("深蹲"), weightKg: 100, reps: 5 }] : []),
                    ...(text.includes("卧推") ? [{ questionId: q("卧推"), weightKg: 80, reps: 5 }] : []),
                    ...(text.includes("硬拉") ? [{ questionId: q("硬拉"), weightKg: 140, reps: 5 }] : []),
                ],
            });
        };
        await activateSubscription();

        for (const message of ["深蹲100 5个", "卧推80 5个", "硬拉140 5个"]) {
            await studentSends(message);
            await runAfterTasks();
        }

        expect(prFor(IDS.squat)).toHaveLength(1);
        expect(prFor(IDS.bench)).toHaveLength(1);
        expect(prFor(IDS.deadlift)).toHaveLength(1);
    });
});

describe("high-rep answer", () => {
    it("does not turn 20 reps into a 1RM, tells the coach, and leaves the load relative", async () => {
        resetWorld({ studentPrs: withoutPr(IDS.squat), studentProfile: { weight: 75 } });
        world.llm.intakeReply = ({ q }) => extraction({ oneRmAnswers: [{ questionId: q("深蹲"), weightKg: 60, reps: 20 }] });

        await activateSubscription();
        const plan = planInstance();
        expect(questionIds()).toEqual([oneRmQuestion(IDS.squat)]);

        await studentSends("深蹲60公斤能做20个");
        await runAfterTasks();

        const intake = intakeState();
        expect(intake.status).toBe("answered");
        expect(intake.recorded).toEqual([expect.objectContaining({ questionId: oneRmQuestion(IDS.squat), uncalibratedReason: "too_many_reps" })]);
        expect(prFor(IDS.squat)).toEqual([]);
        expect(lastCoachNotice()).toContain("次数太多，没折算 1RM");

        const day1 = await startTraining(plan.id, 1);
        expect(plannedSet(day1.json.data, IDS.squat)).toEqual({ weight: null, intensity: "5RM" });
    });
});

describe("student says 不知道", () => {
    it("closes the intake, tells the student how the first session calibrates, and lists the unknowns for the coach", async () => {
        resetWorld({ studentProfile: { weight: 75 } });
        world.llm.intakeReply = ({ questions }) => extraction({ unknownQuestionIds: questions.map((item) => item.id) });

        await activateSubscription();
        const plan = planInstance();
        expect(questionIds()).toEqual([IDS.squat, IDS.bench, IDS.deadlift, IDS.pullup].map(oneRmQuestion).sort());

        await studentSends("都没测过，不知道");
        await runAfterTasks();

        const intake = intakeState();
        expect(intake.status).toBe("answered");
        expect(intake.unknownQuestionIds).toHaveLength(4);
        expect(studentPrs()).toEqual([]);
        expect(String(coachToStudent().at(-1)?.content)).toContain("没测过的动作没关系");
        expect(lastCoachNotice()).toContain("不清楚：");

        const day1 = await startTraining(plan.id, 1);
        expect(plannedSet(day1.json.data, IDS.squat)).toEqual({ weight: null, intensity: "5RM" });
        expect(plannedSet(day1.json.data, IDS.bench)).toEqual({ weight: null, intensity: "75%" });
    });
});

describe("pain mention", () => {
    it("records the numbers, flags the job for the coach, and leaves the plan unchanged", async () => {
        resetWorld({ studentPrs: withoutPr(IDS.bench), studentProfile: { weight: 75 } });
        world.llm.intakeReply = ({ q }) => extraction({
            oneRmAnswers: [{ questionId: q("卧推"), weightKg: 80, reps: 5 }],
            riskNotes: "最近右肩疼",
        });

        await activateSubscription();
        const planBefore = planInstance();

        await studentSends("卧推80公斤5个，不过最近右肩有点疼");
        await runAfterTasks();

        expect(initialPlanJob().needs_coach_confirmation).toBe(true);
        expect(intakeState().riskNotes).toEqual(["最近右肩疼"]);
        expect(prFor(IDS.bench).map((pr) => pr.e1rm)).toEqual([expected.e1rm(80, 5)]);
        expect(String(coachToStudent().at(-1)?.content)).toContain("身体情况我已经转告教练");
        expect(lastCoachNotice()).toContain("⚠ 提到身体问题：最近右肩疼");
        expect(planInstance().training_days).toEqual(planBefore.training_days);
    });

    // 现状（bug 清单 INTAKE-PAIN-ONLY）：只说伤病、没回答任何问题时，规范化后 related=false，
    // 计划助理不处理；教练没开 AI 分身时，学员得不到任何回应，教练也收不到提醒。
    it("current behavior: a pain-only message is not handled by the intake", async () => {
        resetWorld({ studentPrs: withoutPr(IDS.bench), studentProfile: { weight: 75 } });
        world.llm.intakeReply = () => extraction({ riskNotes: "右肩疼，想先不练卧推" });

        await activateSubscription();
        const noticesBefore = systemNotices().length;
        const repliesBefore = coachToStudent().length;
        await studentSends("最近右肩有点疼，卧推能先不做吗");
        await runAfterTasks();

        expect(intakeState().status).toBe("awaiting_reply");
        expect(initialPlanJob().needs_coach_confirmation).toBe(false);
        expect(coachToStudent()).toHaveLength(repliesBefore);
        expect(systemNotices()).toHaveLength(noticesBefore);
    });
});

describe("re-purchasing student with two subscriptions to the same coach", () => {
    it("plans from the student's own 1RMs, never the coach's, and does not ask again", async () => {
        resetWorld({ repurchase: true, studentPrs: ALL_PRS, studentProfile: { weight: 75 } });
        // 上一期的计划，和一份早已过期、仍挂着 awaiting_reply 的计划助理任务。
        world.db.seed("coach_plan_instances", [{
            coach_subscription_id: IDS.oldSubscription,
            coach_id: IDS.coach,
            student_id: IDS.student,
            name: "小王的计划（上一期）",
            status: "completed",
            start_execution_day: 1,
            training_days: buildTrainingDays("W1\nD1\n深蹲 5x5 @5rm\nD2 off\nD3 off\nD4 off\nD5 off\nD6 off\nD7 off"),
            created_at: "2026-09-01T00:00:00.000Z",
        }]);
        seedOldIntakeJob("2026-09-01T00:00:00.000Z");

        expect(await activateSubscription()).toMatchObject({ success: true });
        const plan = planInstance();
        expect(intakeState().status).toBe("not_needed");
        expect(coachToStudent().map((m) => m.content_metadata?.kind)).toEqual(["plan_instance_created"]);

        const stageB = llmCalls("plan").find((call) => call.prompt.includes("plan_script"));
        expect(stageB?.prompt).toContain('"current1RM": 120');
        expect(stageB?.prompt).not.toContain('"current1RM": 230');
        expect(storedLoad(plan, 1, IDS.squat)).toBe(expected.rmLoad(120, 5));

        const day1 = await startTraining(plan.id, 1);
        expect(plannedSet(day1.json.data, IDS.squat).weight).toBe(expected.rmKg(120, 5));

        // 教练打开学员计划，也按学员的 1RM 算。
        const coachView = await getInstance(plan.id, IDS.coachUser);
        expect(coachView.status).toBe(200);
        expect(planLoad(coachView.json.data.instance, 1, IDS.squat).load).toBe(expected.rmLoad(120, 5));
        expect(coachView.json.data.aggregated1RM[IDS.squat]).toBe(120);
    });

    it("routes the reply to the new subscription's intake while an older one is still open", async () => {
        resetWorld({ repurchase: true, studentProfile: { weight: 75 } });
        seedOldIntakeJob("2026-11-03T00:00:00.000Z");
        world.llm.intakeReply = ({ questions }) => extraction({
            oneRmAnswers: questions.filter((item) => item.action === "深蹲").map((item) => ({ questionId: item.id, weightKg: 100, reps: 5 })),
            unknownQuestionIds: questions.filter((item) => item.action !== "深蹲").map((item) => item.id),
        });

        await activateSubscription();
        expect(intakeState().status).toBe("awaiting_reply");

        await studentSends("深蹲100kg 5个，其他没测过");
        await runAfterTasks();

        expect(intakeState().status).toBe("answered");
        expect(initialPlanJob(IDS.oldSubscription).output_snapshot.intake.status).toBe("awaiting_reply");
        expect(prFor(IDS.squat)).toHaveLength(1);
    });
});
