import { describe, expect, it } from "vitest";

import {
    buildTemplateExportFilename,
    formatTemplateToText,
} from "@/lib/planExportText";

describe("formatTemplateToText", () => {
    it("formats training and rest days into import-friendly text", () => {
        const text = formatTemplateToText({
            description: "先热身，再进入正式训练",
            trainingDays: [
                {
                    dayIndex: 1,
                    type: "training",
                    note: "重点做主项",
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
                    note: "休息日",
                    actionSets: [],
                },
            ],
            actionNameById: {
                pullup: "负重引体",
            },
        });

        expect(text).toContain("先热身，再进入正式训练");
        expect(text).toContain("第1周");
        expect(text).toContain("W1D1");
        expect(text).toContain("日备注：重点做主项");
        expect(text).toContain("负重引体 4组 7次 9RM 休息270秒");
        expect(text).toContain("W1D2");
        expect(text).toContain("休息日");
    });

    it("formats one-filter branches with option labels", () => {
        const text = formatTemplateToText({
            trainingDays: [
                {
                    dayIndex: 1,
                    type: "training",
                    note: "",
                    actionSets: [
                        {
                            type: "one-filter",
                            question: {
                                question: "今天状态如何？",
                                options: ["好", "一般"],
                            } as any,
                            actions: [
                                {
                                    type: "no-filter",
                                    actionId: "heavy",
                                    setName: "动作1",
                                    params: { 组数: 3, 次数: 3, 强度: 5 },
                                },
                                {
                                    type: "no-filter",
                                    actionId: "light",
                                    setName: "动作2",
                                    params: { 组数: 3, 次数: 5, 强度: 7 },
                                },
                            ],
                            dayIndex: 1,
                        } as any,
                    ],
                },
            ],
            actionNameById: {
                heavy: "负重引体",
                light: "海豹划船",
            },
        });

        expect(text).toContain("条件分支：今天状态如何？");
        expect(text).toContain("如果「好」：负重引体 3组 3次 5RM");
        expect(text).toContain("如果「一般」：海豹划船 3组 5次 7RM");
    });
});

describe("buildTemplateExportFilename", () => {
    it("sanitizes invalid filename characters", () => {
        expect(buildTemplateExportFilename("15周计划/纯引体?")).toBe(
            "15周计划-纯引体-.txt",
        );
    });
});
