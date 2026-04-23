import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    buildActionLibrary,
    buildPRRecordSummaries,
    buildTemplateSummary,
    generatePersonalizedPlan,
} from "./service";
import { GeneratePersonalizedPlanInput } from "./entity";

const { mockCallDeepSeek } = vi.hoisted(() => ({
    mockCallDeepSeek: vi.fn(),
}));

vi.mock("@/lib/deepseek", () => ({
    callDeepSeek: mockCallDeepSeek,
    parseJsonResponse: <T>(text: string) => JSON.parse(text) as T,
}));

const { mockMaybeSingle, mockInstanceMaybeSingle, mockAutoComputeQuery, mockCoachActionsEq } = vi.hoisted(() => ({
    mockMaybeSingle: vi.fn(),
    mockInstanceMaybeSingle: vi.fn(),
    mockAutoComputeQuery: vi.fn(),
    mockCoachActionsEq: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
    default: {
        from: vi.fn((table: string) => {
            if (table === "coach_plan_templates") {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                maybeSingle: mockMaybeSingle,
                            })),
                        })),
                    })),
                };
            }

            if (table === "coach_plan_instances") {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                maybeSingle: mockInstanceMaybeSingle,
                            })),
                        })),
                    })),
                };
            }

            if (table === "coach_actions") {
                return {
                    select: vi.fn(() => ({
                        eq: mockCoachActionsEq,
                    })),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        }),
    },
}));

const { mockFillTemplate } = vi.hoisted(() => ({
    mockFillTemplate: vi.fn(),
}));

vi.mock("../create-ai-instance/match", () => ({
    fillTemplate: mockFillTemplate,
}));

const makeInput = (overrides?: Partial<GeneratePersonalizedPlanInput>): GeneratePersonalizedPlanInput => ({
    subscriptionId: "sub-1",
    actorUserId: "user-1",
    actorCoachId: "coach-1",
    studentId: "stu-1",
    studentName: "王五",
    subscribedWeeks: null,
    questionnaireAnswers: [],
    studentBodyWeight: 80,
    studentProfile: { goal: "力量", trainingAge: "3年" },
    prRecords: [{ actionName: "深蹲", actionId: "act-1", current1RM: 120, unit: "kg" }],
    actionLibrary: [
        { id: "act-1", name: "深蹲", type: "STRENGTH" },
        { id: "act-2", name: "卧推", type: "STRENGTH" },
    ],
    availableTemplates: [
        { id: "tpl-1", name: "力量基础", description: "适合中级", type: "strength", weekCount: 4, dayCount: 12 },
    ],
    ...overrides,
});

const mockFullTemplate = {
    id: "tpl-1",
    coach_id: "coach-1",
    name: "力量基础",
    description: "4周力量计划",
    type: "strength",
    training_days: [
        {
            type: "training",
            dayIndex: 1,
            actionSets: [
                { type: "no-filter", actionId: "act-1", setName: "深蹲", params: { sets: 5, reps: 5 } },
            ],
        },
        { type: "rest", dayIndex: 2 },
    ],
};

describe("generatePersonalizedPlan", () => {
    beforeEach(() => {
        mockCallDeepSeek.mockReset();
        mockMaybeSingle.mockReset();
        mockInstanceMaybeSingle.mockReset();
        mockAutoComputeQuery.mockReset();
        mockCoachActionsEq.mockReset();
        mockFillTemplate.mockReset();
        mockCoachActionsEq.mockImplementation((column: string) => {
            if (column === "coach_id") {
                return { eq: mockAutoComputeQuery };
            }
            return mockAutoComputeQuery();
        });
        mockAutoComputeQuery.mockResolvedValue({
            data: [
                { id: "act-1", name: "深蹲", canonical_action_id: "sq", enableAutoWeightCompute: true, includesBodyWeight: false },
            ],
            error: null,
        });
        mockFillTemplate.mockImplementation(async (_answers: any, template: any) => {
            template.training_days.forEach((day: any) => {
                day.actionSets?.forEach((action: any) => {
                    action.params.load = 80;
                });
            });
        });
        mockInstanceMaybeSingle.mockResolvedValue({ data: null, error: null });
    });

    it("完整流程：选模板、个性化、校验、计算重量", async () => {
        mockCallDeepSeek
            .mockResolvedValueOnce(JSON.stringify({ template_id: "tpl-1", reasoning: "适合力量计划", confidence: 0.9 }))
            .mockResolvedValueOnce(JSON.stringify({
                plan_script: [
                    "W1",
                    "D1",
                    "深蹲 5x5 r180",
                    "卧推 3x8 r120",
                    "D2 off",
                ].join("\n"),
                reasoning: "增加了卧推",
                changes_summary: "+卧推",
            }));
        mockMaybeSingle.mockResolvedValueOnce({ data: mockFullTemplate, error: null });

        const result = await generatePersonalizedPlan(makeInput());

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(2);
        expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
        expect(mockFillTemplate).toHaveBeenCalledTimes(1);
        expect(result.templateId).toBe("tpl-1");
        expect(result.trainingDays[0].actionSets).toHaveLength(2);
        expect(result.trainingDays[0].actionSets![0].params.load).toBe(80);
        expect(result.aiGenerationLog.stageB.reasoning).toContain("卧推");
    });

    it("选中的模板不可用时改为从零生成，而不是直接报错", async () => {
        mockCallDeepSeek
            .mockResolvedValueOnce(JSON.stringify({ template_id: "tpl-missing", reasoning: "选了这个", confidence: 0.8 }))
            .mockResolvedValueOnce(JSON.stringify({
                plan_script: [
                    "W1",
                    "D1",
                    "深蹲 4x6 r150",
                    "D2 off",
                ].join("\n"),
                reasoning: "模板不可用，改为从零生成",
                changes_summary: "从零生成 2 天计划",
            }));
        mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
        mockInstanceMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

        const result = await generatePersonalizedPlan(makeInput());

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(2);
        expect(result.templateId).toBeNull();
        expect(result.trainingDays[0].actionSets?.[0].actionId).toBe("act-1");
        expect(result.aiGenerationLog.stageA.reasoning).toContain("改为自主生成");
    });

    it("脚本包含动作库外动作名时会明确报错", async () => {
        mockCallDeepSeek
            .mockResolvedValueOnce(JSON.stringify({ template_id: "tpl-1", reasoning: "选这个", confidence: 0.9 }))
            .mockResolvedValueOnce(JSON.stringify({
                plan_script: [
                    "W1",
                    "D1",
                    "深蹲 3x5 r180",
                    "幻觉动作 3x8 r120",
                ].join("\n"),
                reasoning: "测试过滤",
                changes_summary: "过滤",
            }));
        mockMaybeSingle.mockResolvedValueOnce({ data: mockFullTemplate, error: null });

        await expect(generatePersonalizedPlan(makeInput())).rejects.toThrow("AI 生成的计划脚本无法编译");
    });

    it("没有可用模板时允许从零生成", async () => {
        mockCallDeepSeek.mockResolvedValueOnce(JSON.stringify({
            plan_script: [
                "W1",
                "D1",
                "深蹲 4x8 r120",
                "D2 off",
            ].join("\n"),
            reasoning: "没有模板，直接从零生成",
            changes_summary: "生成 2 天计划",
        }));

        const result = await generatePersonalizedPlan(makeInput({ availableTemplates: [] }));

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(1);
        expect(mockMaybeSingle).not.toHaveBeenCalled();
        expect(result.templateId).toBeNull();
        expect(result.trainingDays[0].actionSets?.[0].actionId).toBe("act-1");
        expect(result.aiGenerationLog.stageB.reasoning).toContain("从零生成");
    });

    it("动作库为空时保留模板骨架，不调用 Stage B 从零改写", async () => {
        mockCallDeepSeek
            .mockResolvedValueOnce(JSON.stringify({ template_id: "tpl-1", reasoning: "适合力量计划", confidence: 0.9 }));
        mockMaybeSingle.mockResolvedValueOnce({ data: mockFullTemplate, error: null });

        const result = await generatePersonalizedPlan(makeInput({ actionLibrary: [] }));

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(1);
        expect(result.templateId).toBe("tpl-1");
        expect(result.trainingDays[0].actionSets![0].actionId).toBe("act-1");
        expect(result.aiGenerationLog.stageB.reasoning).toContain("保留已选模板骨架");
    });

    it("没有模板且动作库为空时抛错", async () => {
        await expect(
            generatePersonalizedPlan(makeInput({ availableTemplates: [], actionLibrary: [] })),
        ).rejects.toThrow("动作库为空");
        expect(mockCallDeepSeek).not.toHaveBeenCalled();
    });

    it("学员购买 4 周时，过短的从零计划会被拒绝", async () => {
        mockCallDeepSeek.mockResolvedValueOnce(JSON.stringify({
            plan_script: [
                "W1",
                "D1",
                "深蹲 4x8 r120",
                "D2 off",
                "D3",
                "卧推 4x8 r120",
                "D4 off",
            ].join("\n"),
            reasoning: "先给一个短周期",
            changes_summary: "只有 4 天",
        }));

        await expect(
            generatePersonalizedPlan(makeInput({ availableTemplates: [], subscribedWeeks: 4 })),
        ).rejects.toThrow("计划周期过短");
    });
});

describe("ai-personalize-plan builders", () => {
    it("buildTemplateSummary 计算周数和天数", () => {
        const summary = buildTemplateSummary({
            id: "t1",
            name: "测试模板",
            description: "desc",
            type: "strength",
            training_days: Array(14).fill({ type: "training" }),
        });

        expect(summary.weekCount).toBe(2);
        expect(summary.dayCount).toBe(14);
    });

    it("buildTemplateSummary 兼容空 training_days", () => {
        const summary = buildTemplateSummary({
            id: "t1",
            name: "空模板",
            description: null,
            type: null,
        });

        expect(summary.weekCount).toBe(0);
        expect(summary.dayCount).toBe(0);
    });

    it("buildActionLibrary 兼容当前 schema 的 type/detail 字段", () => {
        const lib = buildActionLibrary([
            { id: "a1", name: "深蹲", type: "STRENGTH", detail: "下肢主项" },
        ]);

        expect(lib[0]).toEqual({
            id: "a1",
            name: "深蹲",
            type: "STRENGTH",
            category: "STRENGTH",
            description: "下肢主项",
        });
    });

    it("buildPRRecordSummaries 映射旧字段", () => {
        expect(buildPRRecordSummaries([
            { name: "卧推", actionId: "a2", one_rm: 90 },
        ])).toEqual([
            { actionName: "卧推", actionId: "a2", current1RM: 90, unit: "kg" },
        ]);
    });
});
