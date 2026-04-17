import { describe, it, expect } from "vitest";
import { validateAndSanitizeTrainingDays } from "./validate-output";
import { ActionLibraryEntry } from "./entity";

const mockActionLib: ActionLibraryEntry[] = [
    { id: "act-1", name: "深蹲" },
    { id: "act-2", name: "卧推" },
    { id: "act-3", name: "硬拉" },
];

describe("validateAndSanitizeTrainingDays", () => {
    it("通过合法的训练日", () => {
        const raw = [
            {
                type: "training",
                dayIndex: 1,
                actionSets: [
                    { type: "no-filter", actionId: "act-1", setName: "深蹲", params: { sets: 3 } },
                    { type: "no-filter", actionId: "act-2", setName: "卧推", params: {} },
                ],
            },
            { type: "rest", dayIndex: 2 },
        ];

        const { days, warnings } = validateAndSanitizeTrainingDays(raw, mockActionLib);

        expect(days).toHaveLength(2);
        expect(days[0].actionSets).toHaveLength(2);
        expect(warnings).toHaveLength(0);
    });

    it("过滤掉不在白名单中的 actionId", () => {
        const raw = [
            {
                type: "training",
                dayIndex: 1,
                actionSets: [
                    { type: "no-filter", actionId: "act-1", setName: "深蹲", params: {} },
                    { type: "no-filter", actionId: "fake-id", setName: "幻觉动作", params: {} },
                ],
            },
        ];

        const { days, warnings } = validateAndSanitizeTrainingDays(raw, mockActionLib);

        expect(days[0].actionSets).toHaveLength(1);
        expect(days[0].actionSets![0].actionId).toBe("act-1");
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]).toContain("fake-id");
    });

    it("跳过缺少 actionId 的动作", () => {
        const raw = [
            {
                type: "training",
                dayIndex: 1,
                actionSets: [
                    { type: "no-filter", actionId: "", setName: "空ID", params: {} },
                    { type: "no-filter", actionId: "act-3", setName: "硬拉", params: {} },
                ],
            },
        ];

        const { days } = validateAndSanitizeTrainingDays(raw, mockActionLib);

        expect(days[0].actionSets).toHaveLength(1);
        expect(days[0].actionSets![0].actionId).toBe("act-3");
    });

    it("重新编号 dayIndex", () => {
        const raw = [
            { type: "training", dayIndex: 5, actionSets: [] },
            { type: "rest", dayIndex: 99 },
        ];

        const { days } = validateAndSanitizeTrainingDays(raw, mockActionLib);

        expect(days[0].dayIndex).toBe(1);
        expect(days[1].dayIndex).toBe(2);
    });

    it("空数组抛出错误", () => {
        expect(() => validateAndSanitizeTrainingDays([], mockActionLib)).toThrow(
            "校验后 training_days 为空",
        );
    });

    it("非法 day 对象被跳过", () => {
        const raw = [null, { type: "training", dayIndex: 1, actionSets: [] }];

        const { days, warnings } = validateAndSanitizeTrainingDays(raw as any[], mockActionLib);

        expect(days).toHaveLength(1);
        expect(warnings.length).toBeGreaterThan(0);
    });
});
