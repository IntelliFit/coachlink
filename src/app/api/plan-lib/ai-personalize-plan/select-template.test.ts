import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectTemplateWithLLM } from "./select-template";
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

describe("selectTemplateWithLLM (Stage A)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("没有可用模板时直接返回 null，不调用 DeepSeek", async () => {
        const input = makeInput({ availableTemplates: [] });

        const result = await selectTemplateWithLLM(input);

        expect(mockCallDeepSeek).not.toHaveBeenCalled();
        expect(result.templateId).toBeNull();
        expect(result.confidence).toBe(1);
        expect(result.reasoning).toContain("没有可用的计划模板");
    });

    it("成功选中一个模板", async () => {
        const input = makeInput();
        mockCallDeepSeek.mockResolvedValueOnce(
            JSON.stringify({
                template_id: "tpl-b",
                reasoning: "学员已有2年训练经验，适合力量进阶模板",
                confidence: 0.92,
            }),
        );

        const result = await selectTemplateWithLLM(input);

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(1);
        // 检查 prompt 中包含了模板列表和学员信息
        const prompt = mockCallDeepSeek.mock.calls[0][0] as string;
        expect(prompt).toContain("tpl-a");
        expect(prompt).toContain("tpl-b");
        expect(prompt).toContain("张三");
        expect(prompt).toContain("增肌");

        expect(result.templateId).toBe("tpl-b");
        expect(result.confidence).toBe(0.92);
        expect(result.reasoning).toContain("力量进阶");
    });

    it("LLM 返回 null 表示没有合适模板", async () => {
        const input = makeInput();
        mockCallDeepSeek.mockResolvedValueOnce(
            JSON.stringify({
                template_id: null,
                reasoning: "学员伤病恢复中，现有模板都不合适",
                confidence: 0.85,
            }),
        );

        const result = await selectTemplateWithLLM(input);

        expect(result.templateId).toBeNull();
        expect(result.confidence).toBe(0.85);
    });

    it("LLM 返回 JSON 缺少字段时使用默认值", async () => {
        const input = makeInput();
        mockCallDeepSeek.mockResolvedValueOnce(
            JSON.stringify({
                template_id: "tpl-a",
                // missing reasoning & confidence
            }),
        );

        const result = await selectTemplateWithLLM(input);

        expect(result.templateId).toBe("tpl-a");
        expect(result.reasoning).toBe("未提供推理");
        expect(result.confidence).toBe(0.5);
    });

    it("DeepSeek API 异常应向上抛出", async () => {
        const input = makeInput();
        mockCallDeepSeek.mockRejectedValueOnce(new Error("DeepSeek 限流"));

        await expect(selectTemplateWithLLM(input)).rejects.toThrow("DeepSeek 限流");
    });
});
