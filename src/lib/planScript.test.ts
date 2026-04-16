import { describe, expect, it } from "vitest";

import { formatTemplateToPlanScript, parsePlanScript } from "@/lib/planScript";

describe("planScript", () => {
    const actions = [
        { id: "pullup-base", name: "负重引体", type: "STRENGTH" },
        { id: "pullup", name: "负重引体（底部暂停）", type: "STRENGTH" },
        { id: "press", name: "实力推", type: "STRENGTH" },
        { id: "curl", name: "锤式弯举", type: "STRENGTH" },
    ] as any;

    it("formats compact plan script", () => {
        const script = formatTemplateToPlanScript({
            description: "这是说明",
            trainingDays: [
                {
                    dayIndex: 1,
                    type: "training",
                    note: "主训练日",
                    actionSets: [
                        {
                            type: "no-filter",
                            actionId: "pullup",
                            setName: "动作1",
                            params: {
                                组数: 4,
                                次数: 7,
                                强度: 9,
                                休息时间: 270,
                            },
                        },
                    ],
                },
                {
                    dayIndex: 2,
                    type: "rest",
                    note: "休息日 & 休息日",
                    actionSets: [],
                },
            ],
            actionNameById: {
                pullup: "负重引体（底部暂停）",
            },
        });

        expect(script).toContain("> 这是说明");
        expect(script).toContain("W1");
        expect(script).toContain("D1");
        expect(script).toContain("!主训练日");
        expect(script).toContain("负重引体（底部暂停） 4x7 @9rm r270");
        expect(script).toContain("D2 off #休息日 & 休息日");
    });

    it("parses compact plan script back into training days", () => {
        const result = parsePlanScript({
            script: `
> 这是说明

W1
D1
!主训练日
负重引体（底部暂停） 4x7 @9rm r270
实力推 3x8 @10rm r180

D2 off #休息日 & 休息日
            `,
            actions,
        });

        expect(result.description).toBe("这是说明");
        expect(result.days).toHaveLength(2);
        expect(result.days[0].dayIndex).toBe(1);
        expect(result.days[0].type).toBe("training");
        expect(result.days[0].note).toBe("主训练日");
        expect(result.days[0].actionSets?.[0]).toMatchObject({
            actionId: "pullup",
            params: {
                组数: 4,
                次数: 7,
                休息时间: 270,
            },
        });
        expect((result.days[0].actionSets?.[0] as any).params.intensityConfig.relativeIntensity).toEqual({
            type: "rm",
            value: 9,
        });
        expect(result.days[1]).toMatchObject({
            dayIndex: 2,
            type: "rest",
            note: "休息日 & 休息日",
        });
    });

    it("prefers exact variant names over fuzzy base action matches", () => {
        const result = parsePlanScript({
            script: `
W1
D1
负重引体（底部暂停） 5x7 @9rm r270
负重引体 3x5 @7rm r180
            `,
            actions,
        });

        expect(result.days[0].actionSets?.[0]).toMatchObject({
            actionId: "pullup",
            setName: "负重引体（底部暂停）",
        });
        expect(result.days[0].actionSets?.[1]).toMatchObject({
            actionId: "pullup-base",
            setName: "负重引体",
        });
    });

    it("does not downgrade missing variant names to base actions", () => {
        expect(() =>
            parsePlanScript({
                script: `
W1
D1
负重引体（顶端暂停） 3x3 @4rm r270
                `,
                actions,
            }),
        ).toThrow(/未找到精确动作：负重引体（顶端暂停）/);
    });
});
