import { describe, it, expect, vi, beforeEach } from "vitest";
import { personalizePlanWithLLM } from "./personalize-plan";
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
    studentName: "李四",
    subscribedWeeks: 1,
    questionnaireAnswers: [
        { id: "q1", question: "训练目标", userSelection: "减脂", type: "text" },
        { id: "q2", question: "每周训练次数", userSelection: 3, type: "times" },
    ],
    studentBodyWeight: 65,
    studentProfile: { goal: "减脂", trainingAge: "1年" },
    prRecords: [
        { actionName: "深蹲", actionId: "act-1", current1RM: 100, unit: "kg" },
    ],
    actionLibrary: [
        { id: "act-1", name: "深蹲", category: "leg" },
        { id: "act-2", name: "卧推", category: "chest" },
    ],
    availableTemplates: [],
    ...overrides,
});

const mockTrainingDays = [
    {
        type: "training",
        dayIndex: 1,
        note: "",
        actionSets: [
            {
                type: "no-filter",
                actionId: "act-1",
                itemType: "STRENGTH",
                setName: "深蹲",
                params: {
                    load: null,
                    note: "",
                    intensityConfig: null,
                    "组数": 4,
                    "次数": 8,
                    "休息时间": 120,
                },
            },
        ],
    },
    { type: "rest", dayIndex: 2, note: "休息日", actionSets: [] },
];

const mockPlanScript = [
    "W1",
    "D1",
    "深蹲 4x8 r120",
    "D2 off",
].join("\n");

describe("personalizePlanWithLLM", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("基于已有模板调计划时 prompt 包含模板骨架", async () => {
        const input = makeInput({
            subscribedWeeks: 4,
            questionnaireAnswers: [
                { id: "q1", question: "训练目标", userSelection: "减脂", type: "text" },
            ],
            selectedTemplate: {
                id: "tpl-1",
                name: "基础增肌",
                description: "4周计划",
                training_days: mockTrainingDays,
            } as any,
        });

        mockCallDeepSeek.mockResolvedValueOnce(JSON.stringify({
            plan_script: mockPlanScript,
            reasoning: "保持原有结构，增加卧推",
            changes_summary: "+卧推",
        }));

        const result = await personalizePlanWithLLM(input);

        const prompt = mockCallDeepSeek.mock.calls[0][0] as string;
        expect(prompt).toContain("基础增肌");
        expect(prompt).toContain("李四");
        expect(prompt).toContain("可用动作库");
        expect(prompt).toContain("plan_script");
        expect(prompt).toContain("深蹲");
        expect(prompt).toContain("本次计划必须覆盖 4 周");
        expect(mockCallDeepSeek.mock.calls[0][1]).toMatchObject({
            useReasoner: true,
            maxTokens: 6000,
        });
        expect(result.trainingDays).toHaveLength(2);
        expect(result.planScript).toContain("W1");
    });

    it("缺少模板时 prompt 明确允许从零生成", async () => {
        mockCallDeepSeek.mockResolvedValueOnce(JSON.stringify({
            plan_script: mockPlanScript,
            reasoning: "缺少模板，直接从零生成",
            changes_summary: "新建 2 天计划",
        }));

        const result = await personalizePlanWithLLM(makeInput({
            questionnaireAnswers: [
                { id: "q1", question: "训练目标", userSelection: "减脂", type: "text" },
            ],
            selectedTemplate: null,
        }));

        const prompt = mockCallDeepSeek.mock.calls[0][0] as string;
        expect(prompt).toContain("当前需要你根据学员上下文与可用动作库，从零设计一个可执行计划");
        expect(prompt).toContain("当前没有可用模板，请直接基于学员上下文和可用动作库，从零生成一个可执行计划");
        expect(prompt).toContain("你输出的不是 training_days JSON，而是紧凑计划脚本");
        expect(prompt).toContain("完整的 7 天日历");
        expect(result.trainingDays).toEqual(mockTrainingDays);
    });

    it("LLM 返回空脚本时返回空数组", async () => {
        mockCallDeepSeek.mockResolvedValueOnce(JSON.stringify({
            plan_script: "",
            reasoning: "无法生成",
            changes_summary: "",
        }));

        const result = await personalizePlanWithLLM(makeInput({ selectedTemplate: null }));

        expect(result.trainingDays).toEqual([]);
    });

    it("允许复用模板中存在但当前动作库未返回的动作名", async () => {
        mockCallDeepSeek.mockResolvedValueOnce(JSON.stringify({
            plan_script: [
                "W1",
                "D1",
                "负重引体（底部暂停） 5x3 r180",
            ].join("\n"),
            reasoning: "保留模板变体动作",
            changes_summary: "延续模板骨架",
        }));

        const result = await personalizePlanWithLLM(makeInput({
            questionnaireAnswers: [
                { id: "q1", question: "训练目标", userSelection: "减脂", type: "text" },
            ],
            actionLibrary: [
                { id: "act-1", name: "深蹲", category: "leg", type: "STRENGTH" },
            ],
            selectedTemplate: {
                id: "tpl-2",
                name: "引体专项",
                description: "专项模板",
                training_days: [
                    {
                        type: "training",
                        dayIndex: 1,
                        actionSets: [
                            {
                                type: "no-filter",
                                actionId: "act-variant",
                                itemType: "STRENGTH",
                                setName: "负重引体（底部暂停）",
                                params: { "组数": 5, "次数": 3 },
                            },
                        ],
                    },
                ],
            } as any,
        }));

        expect(result.trainingDays[0].actionSets?.[0].actionId).toBe("act-variant");
        expect(result.planScript).toContain("负重引体（底部暂停）");
    });

    it("LLM 异常向上抛出", async () => {
        mockCallDeepSeek.mockRejectedValueOnce(new Error("网络超时"));

        await expect(personalizePlanWithLLM(makeInput())).rejects.toThrow("网络超时");
    });

    it("问卷明确每周训练 2 次时，首次生成 3 练会自动重试", async () => {
        const input = makeInput({
            subscribedWeeks: 2,
            questionnaireAnswers: [
                { id: "q1", question: "请选择您偏好的训练项目（可多选）", userSelections: ["臂屈伸个数"], type: "tags" },
                { id: "q2", question: "每周训练次数", options: ["1次", "2次", "3次"], userSelection: 1, type: "option" },
            ],
            actionLibrary: [
                { id: "dip", name: "负重臂屈伸", category: "push", type: "STRENGTH" },
                { id: "curl", name: "锤式弯举", category: "arm", type: "STRENGTH" },
            ],
            selectedTemplate: null,
        });

        mockCallDeepSeek
            .mockResolvedValueOnce(JSON.stringify({
                plan_script: [
                    "W1",
                    "D1",
                    "负重臂屈伸 4x8 r180",
                    "D2 off",
                    "D3",
                    "负重臂屈伸 3x5 r180",
                    "D4 off",
                    "D5",
                    "锤式弯举 3x8 r120",
                    "D6 off",
                    "D7 off",
                    "W2",
                    "D1",
                    "负重臂屈伸 4x8 r180",
                    "D2 off",
                    "D3",
                    "负重臂屈伸 3x5 r180",
                    "D4 off",
                    "D5",
                    "锤式弯举 3x8 r120",
                    "D6 off",
                    "D7 off",
                ].join("\n"),
                reasoning: "先生成了 3 练",
                changes_summary: "3 练版本",
            }))
            .mockResolvedValueOnce(JSON.stringify({
                plan_script: [
                    "W1",
                    "D1",
                    "负重臂屈伸 4x8 r180",
                    "D2 off",
                    "D3 off",
                    "D4",
                    "负重臂屈伸 3x5 r180",
                    "D5 off",
                    "D6 off",
                    "D7 off",
                    "W2",
                    "D1",
                    "负重臂屈伸 4x8 r180",
                    "D2 off",
                    "D3 off",
                    "D4",
                    "锤式弯举 3x8 r120",
                    "D5 off",
                    "D6 off",
                    "D7 off",
                ].join("\n"),
                reasoning: "改成 2 练",
                changes_summary: "2 练版本",
            }));

        const result = await personalizePlanWithLLM(input);

        expect(mockCallDeepSeek).toHaveBeenCalledTimes(2);
        const secondPrompt = mockCallDeepSeek.mock.calls[1][0] as string;
        expect(secondPrompt).toContain("问卷明确每周训练 2 次");
        expect(secondPrompt).toContain("W1 实际安排了 3 个训练日");
        expect(result.trainingDays.filter((day: any) => day.type === "training")).toHaveLength(4);
    });
});
