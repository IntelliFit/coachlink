import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratePersonalizedPlanInput } from "./entity";

const { mockCallDeepSeek } = vi.hoisted(() => ({ mockCallDeepSeek: vi.fn() }));

vi.mock("@/lib/deepseek", () => ({
    callDeepSeek: mockCallDeepSeek,
    parseJsonResponse: <T>(text: string) => JSON.parse(text) as T,
}));

import { salvageTemplateSelection, selectTemplateWithLLM } from "./select-template";
import { personalizePlanWithLLM } from "./personalize-plan";

const TEMPLATE_ID = "0c1d98f6-1234-4abc-8def-0123456789ab";

const makeInput = (overrides?: Partial<GeneratePersonalizedPlanInput>): GeneratePersonalizedPlanInput => ({
    subscriptionId: "sub-1",
    actorUserId: "user-1",
    actorCoachId: "coach-1",
    studentId: "stu-1",
    studentName: "小王",
    subscribedWeeks: 1,
    questionnaireAnswers: [],
    studentBodyWeight: 70,
    studentProfile: {},
    prRecords: [],
    actionLibrary: [{ id: "act-1", name: "深蹲" }],
    availableTemplates: [
        { id: TEMPLATE_ID, name: "力量基础", description: "", type: "strength", source: "template", weekCount: 8, dayCount: 56 },
    ],
    ...overrides,
});

// The shape that failed in production on 2026-10-04: valid up to the UUID, then a key without ASCII quotes.
const BROKEN_STAGE_A = `{\n  "template_id": "${TEMPLATE_ID}",“reasoning”: "最接近学员目标", "confidence": 0.8}`;

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Stage A template pick", () => {
    it("reproduces the production parse error for the broken reply", () => {
        expect(() => JSON.parse(BROKEN_STAGE_A)).toThrow("position 58 (line 2 column 57)");
    });

    it("reads the template id from a broken reply without a second call", async () => {
        mockCallDeepSeek.mockResolvedValueOnce(BROKEN_STAGE_A);

        const result = await selectTemplateWithLLM(makeInput());

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ templateId: TEMPLATE_ID, source: "template", reasoning: "最接近学员目标" });
    });

    it("asks once more when the broken reply has no usable id", async () => {
        mockCallDeepSeek
            .mockResolvedValueOnce('{"template_id": "not-a-candidate", reasoning: x}')
            .mockResolvedValueOnce(JSON.stringify({ template_id: TEMPLATE_ID, reasoning: "重试成功", confidence: 0.9 }));

        const result = await selectTemplateWithLLM(makeInput());

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(2);
        expect(mockCallDeepSeek.mock.calls[1][0]).toContain("上一次的输出不是合法 JSON");
        expect(result.templateId).toBe(TEMPLATE_ID);
    });

    it("gives up with a clear error when both replies are unreadable", async () => {
        mockCallDeepSeek.mockResolvedValue("not json at all");

        await expect(selectTemplateWithLLM(makeInput())).rejects.toThrow("AI 选模板返回的 JSON 两次都无法解析");
        expect(mockCallDeepSeek).toHaveBeenCalledTimes(2);
    });

    it("salvages an explicit null pick and rejects ids that are not candidates", () => {
        const templates = makeInput().availableTemplates;
        expect(salvageTemplateSelection('{"template_id": null, reasoning: 无}', templates)).toMatchObject({ template_id: null });
        expect(salvageTemplateSelection('{"template_id": "other-id",}', templates)).toBeNull();
    });
});

describe("Stage B plan script", () => {
    it("uses the long plan-script client for both attempts", async () => {
        mockCallDeepSeek
            .mockRejectedValueOnce(new Error("Request timed out."))
            .mockResolvedValueOnce(JSON.stringify({ plan_script: "W1\nD1\n深蹲 4x8 r120\nD2 off", reasoning: "", changes_summary: "" }));

        await personalizePlanWithLLM(makeInput({ availableTemplates: [] }));

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(2);
        expect(mockCallDeepSeek.mock.calls[0][1]).toMatchObject({ llm: "planScript", maxTokens: 12000 });
        expect(mockCallDeepSeek.mock.calls[1][1]).toMatchObject({ llm: "planScript", maxTokens: 16000 });
    });
});
