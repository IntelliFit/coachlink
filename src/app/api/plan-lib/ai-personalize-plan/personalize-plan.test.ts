import { describe, it, expect, vi, beforeEach } from "vitest";
import { personalizePlanWithLLM } from "./personalize-plan";
import { GeneratePersonalizedPlanInput } from "./entity";

// ── Mock DeepSeek ──────────────────────────────────────────────
const { mockCallDeepSeek } = vi.hoisted(() => ({
    mockCallDeepSeek: vi.fn(),
}));

vi.mock("@/lib/deepseek", () => ({
    callDeepSeek: mockCallDeepSeek,
    parseJsonResponse: <T>(text: string) => JSON.parse(text) as T,
}));

// ── Fixtures ───────────────────────────────────────────────────
const makeInput = (overrides?: Partial<GeneratePersonalizedPlanInput>): GeneratePersonalizedPlanInput => ({
    subscriptionId: "sub-1",
    actorUserId: "user-1",
    actorCoachId: "coach-1",
    studentId: "stu-1",
    studentName: "李四",
    questionnaireAnswers: [
        { questionId: "q1", answer: "减脂", type: "text" },
        { questionId: "q2", answer: "3", type: "number" },
    ],
    studentBodyWeight: 65,
    studentProfile: { goal: "减脂", trainingAge: "1年" },
    prRecords: [
        { actionName: "深蹲", actionId: "act-1", current1RM: 100, unit: "kg" },
    ],
    actionLibrary: [
        { id: "act-1", name: "深蹲", category: "leg" },
        { id: "act-2", name: "卧推", category: "chest" },
        { id: "act-3", name: "硬拉", category: "back" },
    ],
    availableTemplates: [],
    ...overrides,
});

const mockTrainingDays = [
    {
        type: "training",
        dayIndex: 1,
        actionSets: [
            { type: "no-filter", actionId: "act-1", setName: "深蹲", params: { sets: 4, reps: 8, rest: 120 } },
        ],
    },
    { type: "rest", dayIndex: 2 },
];

describe("personalizePlanWithLLM (Stage B)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("基于已有模板调计划时 prompt 包含模板骨架", async () => {
        const input = makeInput({
            selectedTemplate: {
                id: "tpl-1",
                name: "基础增肌",
                description: "4周计划",
                training_days: mockTrainingDays,
            } as any,
        });

        mockCallDeepSeek.mockResolvedValueOnce(
            JSON.stringify({
                training_days: mockTrainingDays,
                reasoning: "保持原有结构，增加了一组卧推",
                changes_summary: "+1组卧推",
            }),
        );

        const result = await personalizePlanWithLLM(input);

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(1);
        const prompt = mockCallDeepSeek.mock.calls[0][0] as string;

        // prompt 应包含模板信息和学员上下文
        expect(prompt).toContain("基础增肌");
        expect(prompt).toContain("李四");
        expect(prompt).toContain("act-1");
        expect(prompt).toContain("深蹲");
        expect(prompt).toContain("可用动作库");
        expect(prompt).toContain("最新PR记录");

        // 检查 options: useReasoner=true, maxTokens=6000
        expect(mockCallDeepSeek.mock.calls[0][1]).toMatchObject({
            useReasoner: true,
            maxTokens: 6000,
        });

        expect(result.trainingDays).toHaveLength(2);
        expect(result.reasoning).toContain("卧推");
    });

    it("从零生成计划时 prompt 不包含模板骨架", async () => {
        const input = makeInput({ selectedTemplate: null });

        mockCallDeepSeek.mockResolvedValueOnce(
            JSON.stringify({
                training_days: [
                    { type: "training", dayIndex: 1, actionSets: [{ type: "no-filter", actionId: "act-2", setName: "卧推", params: {} }] },
                ],
                reasoning: "学员只想练上肢",
                changes_summary: "从零设计",
            }),
        );

        const result = await personalizePlanWithLLM(input);

        const prompt = mockCallDeepSeek.mock.calls[0][0] as string;
        expect(prompt).toContain("无。请从零为学员设计");
        expect(prompt).toContain("【已选模板骨架】");

        expect(result.trainingDays[0].actionSets![0].actionId).toBe("act-2");
    });

    it("LLM 返回空 training_days 时返回空数组", async () => {
        const input = makeInput({ selectedTemplate: null });

        mockCallDeepSeek.mockResolvedValueOnce(
            JSON.stringify({
                training_days: [],
                reasoning: "无法生成",
                changes_summary: "",
            }),
        );

        const result = await personalizePlanWithLLM(input);

        expect(result.trainingDays).toEqual([]);
    });

    it("DeepSeek API 异常应向上抛出", async () => {
        const input = makeInput({ selectedTemplate: null });
        mockCallDeepSeek.mockRejectedValueOnce(new Error("网络超时"));

        await expect(personalizePlanWithLLM(input)).rejects.toThrow("网络超时");
    });
});
