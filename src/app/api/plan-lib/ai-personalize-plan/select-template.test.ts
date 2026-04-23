import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectTemplateWithLLM } from "./select-template";
import { GeneratePersonalizedPlanInput } from "./entity";

const { mockCallDeepSeek } = vi.hoisted(() => ({
    mockCallDeepSeek: vi.fn(),
}));

vi.mock("@/lib/deepseek", () => ({
    callDeepSeek: mockCallDeepSeek,
    parseJsonResponse: <T>(text: string) => JSON.parse(text) as T,
}));

const makeInput = (overrides?: Partial<GeneratePersonalizedPlanInput>): GeneratePersonalizedPlanInput => ({
    subscriptionId: "sub-1",
    actorUserId: "user-1",
    actorCoachId: "coach-1",
    studentId: "stu-1",
    studentName: "张三",
    questionnaireAnswers: [],
    studentBodyWeight: 70,
    studentProfile: { goal: "增肌", trainingAge: "2年" },
    prRecords: [],
    actionLibrary: [],
    availableTemplates: [
        { id: "tpl-a", name: "增肌基础", description: "适合新手", type: "hypertrophy", weekCount: 4, dayCount: 12 },
        { id: "tpl-b", name: "力量进阶", description: "适合中级", type: "strength", weekCount: 8, dayCount: 24 },
    ],
    ...overrides,
});

describe("selectTemplateWithLLM", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("没有可用模板时直接返回 null，不调用 LLM", async () => {
        const result = await selectTemplateWithLLM(makeInput({ availableTemplates: [] }));

        expect(mockCallDeepSeek).not.toHaveBeenCalled();
        expect(result.templateId).toBeNull();
        expect(result.confidence).toBe(1);
    });

    it("成功选中模板", async () => {
        mockCallDeepSeek.mockResolvedValueOnce(JSON.stringify({
            template_id: "tpl-b",
            reasoning: "学员已有训练经验，适合力量进阶模板",
            confidence: 0.92,
        }));

        const result = await selectTemplateWithLLM(makeInput());

        const prompt = mockCallDeepSeek.mock.calls[0][0] as string;
        expect(prompt).toContain("tpl-a");
        expect(prompt).toContain("tpl-b");
        expect(prompt).toContain("张三");
        expect(result.templateId).toBe("tpl-b");
        expect(result.confidence).toBe(0.92);
    });

    it("LLM 返回 null 表示没有合适模板", async () => {
        mockCallDeepSeek.mockResolvedValueOnce(JSON.stringify({
            template_id: null,
            reasoning: "现有模板都不合适",
            confidence: 0.85,
        }));

        const result = await selectTemplateWithLLM(makeInput());

        expect(result.templateId).toBeNull();
        expect(result.confidence).toBe(0.85);
    });

    it("LLM 返回缺省字段时使用默认值", async () => {
        mockCallDeepSeek.mockResolvedValueOnce(JSON.stringify({ template_id: "tpl-a" }));

        const result = await selectTemplateWithLLM(makeInput());

        expect(result.templateId).toBe("tpl-a");
        expect(result.reasoning).toBe("未提供推理");
        expect(result.confidence).toBe(0.5);
    });

    it("LLM 异常向上抛出", async () => {
        mockCallDeepSeek.mockRejectedValueOnce(new Error("LLM 限流"));

        await expect(selectTemplateWithLLM(makeInput())).rejects.toThrow("LLM 限流");
    });
});
