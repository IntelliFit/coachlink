import { describe, it, expect, vi, beforeEach } from "vitest";
import { generatePersonalizedPlan, buildTemplateSummary, buildActionLibrary } from "./service";
import { GeneratePersonalizedPlanInput } from "./entity";

// ── Mock DeepSeek ──────────────────────────────────────────────
const { mockCallDeepSeek } = vi.hoisted(() => ({
    mockCallDeepSeek: vi.fn(),
}));

vi.mock("@/lib/deepseek", () => ({
    callDeepSeek: mockCallDeepSeek,
    parseJsonResponse: <T>(text: string) => JSON.parse(text) as T,
}));

// ── Mock Supabase ──────────────────────────────────────────────
const mockSupabaseChain = vi.hoisted(() => {
    const chain: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
    };
    // 让 from() 返回 chain，支持链式调用
    chain.from = vi.fn(() => chain);
    return chain;
});

vi.mock("@/lib/supabaseClient", () => ({
    default: mockSupabaseChain,
    serviceRoleSupabase: mockSupabaseChain,
}));

// ── Mock fillTemplate ──────────────────────────────────────────
const { mockFillTemplate } = vi.hoisted(() => ({
    mockFillTemplate: vi.fn(),
}));

vi.mock("../create-ai-instance/match", () => ({
    fillTemplate: mockFillTemplate,
}));

// ── Fixtures ───────────────────────────────────────────────────
const makeInput = (overrides?: Partial<GeneratePersonalizedPlanInput>): GeneratePersonalizedPlanInput => ({
    subscriptionId: "sub-1",
    actorUserId: "user-1",
    actorCoachId: "coach-1",
    studentId: "stu-1",
    studentName: "王五",
    questionnaireAnswers: [],
    studentBodyWeight: 80,
    studentProfile: { goal: "力量", trainingAge: "3年" },
    prRecords: [{ actionName: "深蹲", actionId: "act-1", current1RM: 120, unit: "kg" }],
    actionLibrary: [
        { id: "act-1", name: "深蹲" },
        { id: "act-2", name: "卧推" },
    ],
    availableTemplates: [
        { id: "tpl-1", name: "力量基础", description: "适合中级", type: "strength", weekCount: 4, dayCount: 12 },
    ],
    ...overrides,
});

const mockFullTemplate = {
    id: "tpl-1",
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

const mockAutoComputeActions = [
    { id: "act-1", name: "深蹲", canonical_action_id: "sq", enableAutoWeightCompute: true, includesBodyWeight: false },
];

describe("generatePersonalizedPlan (全流程编排器)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabaseChain.single.mockReset();
    });

    it("完整流程：Stage A 选模板 → Stage B 调计划 → 校验 → 计算重量", async () => {
        const input = makeInput();

        // Stage A: LLM 选中 tpl-1
        mockCallDeepSeek
            .mockResolvedValueOnce(
                JSON.stringify({ template_id: "tpl-1", reasoning: "学员适合力量计划", confidence: 0.9 }),
            )
            // Stage B: LLM 调计划
            .mockResolvedValueOnce(
                JSON.stringify({
                    training_days: [
                        {
                            type: "training",
                            dayIndex: 1,
                            actionSets: [
                                { type: "no-filter", actionId: "act-1", setName: "深蹲", params: { sets: 5, reps: 5 } },
                                { type: "no-filter", actionId: "act-2", setName: "卧推", params: { sets: 3, reps: 8 } },
                            ],
                        },
                        { type: "rest", dayIndex: 2 },
                    ],
                    reasoning: "增加了卧推",
                    changes_summary: "+卧推",
                }),
            );

        // Mock Supabase 查询模板
        mockSupabaseChain.single
            .mockResolvedValueOnce({ data: mockFullTemplate, error: null }) // coach_plan_templates
            .mockResolvedValueOnce({ data: mockAutoComputeActions, error: null }); // coach_actions

        // Mock fillTemplate：模拟副作用——给动作加上 weight
        mockFillTemplate.mockImplementation(async (_answers: any, template: any, _opts: any) => {
            template.training_days.forEach((day: any) => {
                if (day.actionSets) {
                    day.actionSets.forEach((action: any) => {
                        if (!action.params.load) {
                            action.params.load = 80; // 模拟计算出的重量
                        }
                    });
                }
            });
        });

        const result = await generatePersonalizedPlan(input);

        // ── 验证 Stage A ──
        expect(mockCallDeepSeek).toHaveBeenCalledTimes(2);
        expect(result.templateId).toBe("tpl-1");

        // ── 验证 Supabase 查询 ──
        expect(mockSupabaseChain.from).toHaveBeenCalledWith("coach_plan_templates");
        expect(mockSupabaseChain.from).toHaveBeenCalledWith("coach_actions");

        // ── 验证 fillTemplate 被调用且传入了正确参数 ──
        expect(mockFillTemplate).toHaveBeenCalledTimes(1);
        const fillTemplateArgs = mockFillTemplate.mock.calls[0];
        expect(fillTemplateArgs[2]).toMatchObject({
            studentBodyWeight: 80,
            studentId: "stu-1",
            coachId: "coach-1",
        });

        // ── 验证输出 ──
        expect(result.trainingDays).toHaveLength(2);
        // 第一个训练日应包含两个动作
        expect(result.trainingDays[0].actionSets).toHaveLength(2);
        // fillTemplate 应该给动作加上了 weight
        expect(result.trainingDays[0].actionSets![0].params.load).toBe(80);

        // ── 验证 aiGenerationLog ──
        expect(result.aiGenerationLog).toBeDefined();
        expect(result.aiGenerationLog.stageA.templateId).toBe("tpl-1");
        expect(result.aiGenerationLog.stageB.reasoning).toContain("卧推");
        expect(result.aiGenerationLog.promptVersion).toBe("v1.0");
        expect(result.aiGenerationLog.model).toContain("deepseek");
        expect(new Date(result.aiGenerationLog.timestamp)).toBeInstanceOf(Date);
    });

    it("Stage A 选中的模板不存在时，fallback 到从零生成", async () => {
        const input = makeInput();

        // Stage A: LLM 选中 tpl-1（但数据库里没有）
        mockCallDeepSeek
            .mockResolvedValueOnce(
                JSON.stringify({ template_id: "tpl-missing", reasoning: "选了这个", confidence: 0.8 }),
            )
            // Stage B: 从零生成
            .mockResolvedValueOnce(
                JSON.stringify({
                    training_days: [
                        { type: "training", dayIndex: 1, actionSets: [{ type: "no-filter", actionId: "act-1", setName: "深蹲", params: {} }] },
                    ],
                    reasoning: "模板不存在，从零生成",
                    changes_summary: "从零",
                }),
            );

        // 模板查询返回 null
        mockSupabaseChain.single
            .mockResolvedValueOnce({ data: null, error: null }) // coach_plan_templates → null
            .mockResolvedValueOnce({ data: mockAutoComputeActions, error: null }); // coach_actions

        mockFillTemplate.mockImplementation(async () => {});

        const result = await generatePersonalizedPlan(input);

        // templateId 应为 null（因为选中的模板不存在，stageA 被修改了）
        expect(result.templateId).toBeNull();
        // 但训练日仍然生成了
        expect(result.trainingDays).toHaveLength(1);
        // Stage A 的 reasoning 应被追加提示
        expect(result.aiGenerationLog.stageA.reasoning).toContain("不存在");
    });

    it("Stage B 返回的幻觉 actionId 被 validate 过滤掉", async () => {
        const input = makeInput();

        mockCallDeepSeek
            .mockResolvedValueOnce(
                JSON.stringify({ template_id: "tpl-1", reasoning: "选这个", confidence: 0.9 }),
            )
            .mockResolvedValueOnce(
                JSON.stringify({
                    training_days: [
                        {
                            type: "training",
                            dayIndex: 1,
                            actionSets: [
                                { type: "no-filter", actionId: "act-1", setName: "深蹲", params: {} },
                                { type: "no-filter", actionId: "hallucinated-id", setName: "幻觉动作", params: {} },
                            ],
                        },
                    ],
                    reasoning: "测试幻觉过滤",
                    changes_summary: "有幻觉",
                }),
            );

        mockSupabaseChain.single
            .mockResolvedValueOnce({ data: mockFullTemplate, error: null })
            .mockResolvedValueOnce({ data: mockAutoComputeActions, error: null });

        mockFillTemplate.mockImplementation(async () => {});

        const result = await generatePersonalizedPlan(input);

        // hallucinated-id 应被过滤掉
        expect(result.trainingDays[0].actionSets).toHaveLength(1);
        expect(result.trainingDays[0].actionSets![0].actionId).toBe("act-1");
    });

    it("没有可用模板时，直接走 Stage B 从零生成", async () => {
        const input = makeInput({ availableTemplates: [] });

        // 只调用一次 DeepSeek（Stage A 直接返回，不调用；Stage B 调用）
        mockCallDeepSeek.mockResolvedValueOnce(
            JSON.stringify({
                training_days: [
                    { type: "training", dayIndex: 1, actionSets: [{ type: "no-filter", actionId: "act-1", setName: "深蹲", params: {} }] },
                ],
                reasoning: "从零生成",
                changes_summary: "全新",
            }),
        );

        mockSupabaseChain.single.mockResolvedValueOnce({ data: mockAutoComputeActions, error: null });
        mockFillTemplate.mockImplementation(async () => {});

        const result = await generatePersonalizedPlan(input);

        // Stage A 不调用 DeepSeek，所以总共只调用 1 次（Stage B）
        expect(mockCallDeepSeek).toHaveBeenCalledTimes(1);
        expect(result.templateId).toBeNull();
    });
});

describe("buildTemplateSummary", () => {
    it("正确计算周数和天数", () => {
        const tpl = {
            id: "t1",
            name: "测试模板",
            description: "desc",
            type: "strength",
            training_days: Array(14).fill({ type: "training" }),
        };
        const summary = buildTemplateSummary(tpl);
        expect(summary.weekCount).toBe(2);
        expect(summary.dayCount).toBe(14);
        expect(summary.name).toBe("测试模板");
    });

    it("training_days 为空时返回 0", () => {
        const tpl = { id: "t1", name: "空模板", description: null, type: null, training_days: undefined };
        const summary = buildTemplateSummary(tpl);
        expect(summary.dayCount).toBe(0);
        expect(summary.weekCount).toBe(0);
    });
});

describe("buildActionLibrary", () => {
    it("正确映射动作库", () => {
        const actions = [
            { id: "a1", name: "深蹲", category: "leg", description: "desc" },
            { id: "a2", name: "卧推" },
        ];
        const lib = buildActionLibrary(actions);
        expect(lib).toHaveLength(2);
        expect(lib[0]).toEqual({ id: "a1", name: "深蹲", category: "leg", description: "desc" });
        expect(lib[1]).toEqual({ id: "a2", name: "卧推", category: undefined, description: undefined });
    });

    it("空数组返回空数组", () => {
        expect(buildActionLibrary([])).toEqual([]);
    });
});
