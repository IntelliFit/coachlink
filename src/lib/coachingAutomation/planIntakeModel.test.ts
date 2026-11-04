import { describe, expect, it } from "vitest";
import {
    buildCoachNotice,
    buildIntakeQuestions,
    buildStudentConfirmation,
    estimateOneRmFromAnswer,
    findMissingPlanInputs,
    formatIntakeQuestionMessage,
    normalizeIntakeReply,
    type PlanActionInfo,
} from "./planIntakeModel";

const actions = new Map<string, PlanActionInfo>([
    ["bench", { id: "bench", name: "卧推", canonicalActionId: "c-bench", includesBodyWeight: false, type: "STRENGTH" }],
    ["pull", { id: "pull", name: "负重引体（底部暂停）", includesBodyWeight: true, type: "STRENGTH" }],
    ["curl", { id: "curl", name: "二头弯举", includesBodyWeight: false, type: "STRENGTH" }],
    ["run", { id: "run", name: "慢跑", includesBodyWeight: false, type: "CARDIO" }],
]);

const set = (actionId: string, params: Record<string, unknown>) => ({ type: "no-filter", actionId, params });

const trainingDays = [
    {
        type: "training",
        dayIndex: 1,
        actionSets: [
            set("bench", { 组数: 5, 次数: 5, 强度: 5 }),
            set("pull", { 组数: 4, 次数: 3, intensityConfig: { relativeIntensity: { type: "rm", value: 5 } } }),
            set("curl", { 组数: 3, 次数: 10, 强度: "70%1RM" }),
            set("run", { 持续时间: 900, 强度: 5 }),
        ],
    },
    { type: "rest", dayIndex: 2 },
    {
        type: "training",
        dayIndex: 3,
        actionSets: [
            set("pull", { 组数: 4, 次数: 3, 强度: 5 }),
            set("curl", { 组数: 3, 次数: 10, load: 12, fixedLoadOverride: true, 强度: 10 }),
        ],
    },
];

describe("findMissingPlanInputs", () => {
    it("lists dynamic-intensity strength actions without a 1RM, most frequent first", () => {
        const result = findMissingPlanInputs({
            trainingDays,
            actions,
            oneRmKeys: new Set(["c-bench"]),
            bodyWeight: null,
        });
        expect(result.missingOneRm.map((a) => [a.actionId, a.occurrences])).toEqual([
            ["pull", 2],
            ["curl", 1],
        ]);
        expect(result.needsBodyWeight).toBe(true);
    });

    it("skips days before the start day and needs no body weight when it is known", () => {
        const result = findMissingPlanInputs({
            trainingDays,
            startExecutionDay: 3,
            actions,
            oneRmKeys: new Set(),
            bodyWeight: 70,
        });
        expect(result.missingOneRm.map((a) => a.actionId)).toEqual(["pull"]);
        expect(result.needsBodyWeight).toBe(false);
    });

    it("matches known 1RMs by action name as well", () => {
        const result = findMissingPlanInputs({
            trainingDays,
            actions,
            oneRmKeys: new Set(["卧推", "负重引体（底部暂停）", "curl"]),
            bodyWeight: 70,
        });
        expect(result.missingOneRm).toEqual([]);
    });
});

describe("intake questions and message", () => {
    const questions = buildIntakeQuestions({
        missingOneRm: [
            { actionId: "pull", actionName: "负重引体（底部暂停）", includesBodyWeight: true, occurrences: 2 },
            { actionId: "curl", actionName: "二头弯举", includesBodyWeight: false, occurrences: 1 },
        ],
        needsBodyWeight: true,
        openQuestions: ["问卷里说左肩不舒服，现在做引体会疼吗？"],
    });

    it("asks body weight first, then each lift, then open questions", () => {
        expect(questions.map((q) => q.id)).toEqual(["body_weight", "one_rm:pull", "one_rm:curl", "open:0"]);
        expect(questions[1].prompt).toContain("加多少公斤负重");
        expect(questions[2].prompt).toContain("用多重能做几个");
    });

    it("caps the number of lift questions", () => {
        const many = buildIntakeQuestions({
            missingOneRm: Array.from({ length: 6 }, (_, i) => ({
                actionId: `a${i}`, actionName: `动作${i}`, includesBodyWeight: false, occurrences: 1,
            })),
            needsBodyWeight: false,
        });
        expect(many).toHaveLength(4);
    });

    it("numbers the questions and says the assistant is AI", () => {
        const text = formatIntakeQuestionMessage({ studentName: "小王", coachName: "李", planPublished: true, questions });
        expect(text).toContain("小王你好，我是李的计划助理（AI）");
        expect(text).toContain("你的训练计划已经发到「今日训练」");
        expect(text).not.toContain("首个");
        expect(text).toContain("1. 你现在的体重大概多少公斤？");
        expect(text).toContain("4. 问卷里说左肩不舒服");
    });
});

describe("normalizeIntakeReply", () => {
    const pending = buildIntakeQuestions({
        missingOneRm: [
            { actionId: "pull", actionName: "负重引体", includesBodyWeight: true, occurrences: 1 },
            { actionId: "curl", actionName: "二头弯举", includesBodyWeight: false, occurrences: 1 },
        ],
        needsBodyWeight: true,
        openQuestions: ["家里有单杠吗？"],
    });

    it("keeps only valid answers to pending questions", () => {
        const reply = normalizeIntakeReply({
            related: true,
            bodyWeightKg: 75.25,
            oneRmAnswers: [
                { questionId: "one_rm:pull", weightKg: 20, reps: 3.2 },
                { questionId: "one_rm:curl", weightKg: 0, reps: 10 },
                { questionId: "one_rm:unknown", weightKg: 50, reps: 5 },
                { questionId: "one_rm:pull", weightKg: 30, reps: 1 },
            ],
            openAnswers: [{ questionId: "open:0", answer: "  有，门框单杠  " }],
            unknownQuestionIds: ["one_rm:curl", "one_rm:curl", "body_weight", "nope"],
            riskNotes: "",
            otherNotes: "周末才有时间",
        }, pending);

        expect(reply.bodyWeightKg).toBe(75.3);
        expect(reply.oneRmAnswers).toEqual([{ questionId: "one_rm:pull", weightKg: 20, reps: 3 }]);
        expect(reply.openAnswers).toEqual([{ questionId: "open:0", answer: "有，门框单杠" }]);
        expect(reply.unknownQuestionIds).toEqual(["one_rm:curl"]);
        expect(reply.otherNotes).toBe("周末才有时间");
        expect(reply.related).toBe(true);
    });

    it("allows assisted (negative) loads only for bodyweight lifts and rejects absurd numbers", () => {
        const reply = normalizeIntakeReply({
            bodyWeightKg: 500,
            oneRmAnswers: [
                { questionId: "one_rm:pull", weightKg: -15, reps: 5 },
                { questionId: "one_rm:curl", weightKg: -5, reps: 5 },
            ],
        }, pending);
        expect(reply.bodyWeightKg).toBeNull();
        expect(reply.oneRmAnswers).toEqual([{ questionId: "one_rm:pull", weightKg: -15, reps: 5 }]);
    });

    it("treats a message that answers nothing as unrelated, even with notes", () => {
        expect(normalizeIntakeReply({ related: true, oneRmAnswers: [], riskNotes: "  " }, pending).related).toBe(false);
        expect(normalizeIntakeReply({ related: true, riskNotes: "腿好酸", otherNotes: "周三出差" }, pending).related).toBe(false);
    });

    it("strips links and markdown from student text before it reaches the coach notice", () => {
        const reply = normalizeIntakeReply({
            bodyWeightKg: 70,
            otherNotes: "详见 [官方通知](https://evil.example/x) www.evil.example **快**",
        }, pending);
        expect(reply.otherNotes).toBe("详见 官方通知 快");
    });
});

describe("estimateOneRmFromAnswer", () => {
    const e1rm = (r: ReturnType<typeof estimateOneRmFromAnswer>) => (r.status === "ok" ? r.e1rm : null);

    it("uses the three-formula average and needs body weight for bodyweight lifts", () => {
        expect(estimateOneRmFromAnswer({ weightKg: 100, reps: 1, includesBodyWeight: false, bodyWeight: null })).toEqual({ status: "ok", e1rm: 100 });
        const bench = e1rm(estimateOneRmFromAnswer({ weightKg: 60, reps: 5, includesBodyWeight: false, bodyWeight: null }));
        expect(bench).toBeGreaterThan(65);
        expect(bench).toBeLessThan(70);
        expect(estimateOneRmFromAnswer({ weightKg: 20, reps: 3, includesBodyWeight: true, bodyWeight: null })).toEqual({ status: "needs_body_weight" });
        const pull = e1rm(estimateOneRmFromAnswer({ weightKg: 20, reps: 3, includesBodyWeight: true, bodyWeight: 75 }));
        expect(pull).toBeGreaterThan(25);
        expect(pull).toBeLessThan(30);
    });

    it("refuses high-rep answers that would inflate the peak 1RM", () => {
        expect(estimateOneRmFromAnswer({ weightKg: 40, reps: 30, includesBodyWeight: false, bodyWeight: null }))
            .toEqual({ status: "not_estimable", reason: "too_many_reps" });
        expect(estimateOneRmFromAnswer({ weightKg: 0, reps: 25, includesBodyWeight: true, bodyWeight: 70 }))
            .toEqual({ status: "not_estimable", reason: "too_many_reps" });
        expect(e1rm(estimateOneRmFromAnswer({ weightKg: 40, reps: 12, includesBodyWeight: false, bodyWeight: null }))).toBeGreaterThan(50);
    });

    it("does not record assisted or single bodyweight reps as a 1RM", () => {
        expect(estimateOneRmFromAnswer({ weightKg: -15, reps: 5, includesBodyWeight: true, bodyWeight: 75 }))
            .toEqual({ status: "not_estimable", reason: "no_external_load" });
        expect(estimateOneRmFromAnswer({ weightKg: 0, reps: 1, includesBodyWeight: true, bodyWeight: 75 }))
            .toEqual({ status: "not_estimable", reason: "no_external_load" });
    });
});

describe("reply messages", () => {
    const records = [
        { questionId: "body_weight", bodyWeightKg: 75 },
        { questionId: "one_rm:pull", actionName: "负重引体", weightKg: 20, reps: 3, e1rm: 27.4 },
    ];

    it("confirms what was recorded and asks for the rest once", () => {
        const text = buildStudentConfirmation({
            newRecords: records,
            remaining: [{ id: "one_rm:curl", kind: "one_rm", prompt: "二头弯举：最近一次用多重能做几个？", actionId: "curl", actionName: "二头弯举", includesBodyWeight: false }],
            askForRemaining: true,
            hasUnknown: false,
            hasNotes: false,
            hasRisk: true,
        });
        expect(text).toContain("已记录：体重 75kg；负重引体 20kg×3，估算 1RM 27.4kg");
        expect(text).toContain("转告教练");
        expect(text).toContain("1. 二头弯举");
    });

    it("tells the coach about risks without claiming the plan changed", () => {
        const text = buildCoachNotice({
            studentName: "小王",
            newRecords: records,
            uncalibrated: [{ questionId: "one_rm:dip", actionName: "负重臂屈伸", weightKg: 0, reps: 25, uncalibratedReason: "too_many_reps" }],
            unknownLabels: ["二头弯举"],
            openAnswers: [],
            otherNotes: "",
            riskNotes: "左肩做引体时疼",
            remainingCount: 0,
        });
        expect(text).toContain("学员「小王」");
        expect(text).toContain("不清楚：二头弯举");
        expect(text).toContain("已回答但没记 1RM：负重臂屈伸 0kg×25，次数太多，没折算 1RM");
        expect(text).toContain("⚠ 提到身体问题：左肩做引体时疼。计划没有自动修改");
    });
});
