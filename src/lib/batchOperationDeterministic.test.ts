import { describe, expect, it } from "vitest";
import { tryApplyDeterministicBatchEdit } from "@/lib/batchOperationDeterministic";

describe("tryApplyDeterministicBatchEdit", () => {
    it("replaces the last matching action in the target weekday range and updates sets/reps/rm", () => {
        const actions = [
            { id: "pullup", name: "负重引体", type: "STRENGTH" },
            { id: "seal-row", name: "海豹划船", type: "STRENGTH" },
            { id: "squat", name: "深蹲", type: "STRENGTH" },
        ];

        const trainingDays = Array.from({ length: 15 * 7 }, (_, index) => {
            const dayIndex = index + 1;
            const dayOfWeek = ((dayIndex - 1) % 7) + 1;
            const week = Math.ceil(dayIndex / 7);
            if (dayOfWeek !== 3) {
                return { dayIndex, type: "rest", note: "", actionSets: [] };
            }
            return {
                dayIndex,
                type: "training",
                note: `week-${week}`,
                actionSets: [
                    { type: "no-filter", actionId: "pullup", itemType: "STRENGTH", params: { sets: 5, reps: 5 } },
                    { type: "no-filter", actionId: "squat", itemType: "STRENGTH", params: { sets: 3, reps: 3 } },
                    { type: "no-filter", actionId: "pullup", itemType: "STRENGTH", params: { sets: 4, reps: 4 } },
                    { type: "no-filter", actionId: "pullup", itemType: "STRENGTH", params: { sets: 6, reps: 2 } },
                ],
            };
        });

        const result = tryApplyDeterministicBatchEdit({
            instruction: "第5周到第15周的第3天 一共出现了3次负重引体 最后1次负重引体全部换成海豹划船 3组8次 10rm",
            trainingDays,
            actions,
        });

        expect(result.matched).toBe(true);
        expect(result.applied).toBe(true);

        const targetDay = result.updatedTrainingDays.find((day: any) => day.dayIndex === ((5 - 1) * 7 + 3));
        expect(targetDay.actionSets[3].actionId).toBe("seal-row");
        expect(targetDay.actionSets[3].params.sets).toBe(3);
        expect(targetDay.actionSets[3].params.reps).toBe(8);
        expect(targetDay.actionSets[3].params["强度"]).toBe(10);
        expect(targetDay.actionSets[3].params.intensityConfig.relativeIntensity).toEqual({
            type: "rm",
            value: 10,
        });

        const untouchedDay = result.updatedTrainingDays.find((day: any) => day.dayIndex === ((4 - 1) * 7 + 3));
        expect(untouchedDay.actionSets[3].actionId).toBe("pullup");
    });

    it("matches broader mentions like 负重引体 against concrete action names", () => {
        const actions = [
            { id: "pronated-weighted-pullup", name: "正手负重引体", type: "STRENGTH" },
            { id: "seal-row", name: "海豹划船", type: "STRENGTH" },
        ];

        const trainingDays = [
            {
                dayIndex: 3,
                type: "training",
                note: "",
                actionSets: [
                    { type: "no-filter", actionId: "pronated-weighted-pullup", itemType: "STRENGTH", params: { sets: 4, reps: 4 } },
                    { type: "no-filter", actionId: "pronated-weighted-pullup", itemType: "STRENGTH", params: { sets: 5, reps: 3 } },
                ],
            },
        ];

        const result = tryApplyDeterministicBatchEdit({
            instruction: "第1周第3天最后1次负重引体改成海豹划船 3组8次 10RM",
            trainingDays,
            actions,
        });

        expect(result.applied).toBe(true);
        expect(result.updatedTrainingDays[0].actionSets[1].actionId).toBe("seal-row");
        expect(result.updatedTrainingDays[0].actionSets[0].actionId).toBe("pronated-weighted-pullup");
    });

    it("deletes the third occurrence when the target days contain exactly three matching actions", () => {
        const actions = [
            { id: "pullup-bottom", name: "负重引体（底部暂停）", type: "STRENGTH" },
            { id: "pullup-top", name: "负重引体（顶端暂停）", type: "STRENGTH" },
            { id: "curl", name: "锤式弯举", type: "STRENGTH" },
        ];

        const trainingDays = Array.from({ length: 15 * 7 }, (_, index) => {
            const dayIndex = index + 1;
            const dayOfWeek = ((dayIndex - 1) % 7) + 1;
            if (dayOfWeek !== 1 && dayOfWeek !== 3) {
                return { dayIndex, type: "rest", note: "", actionSets: [] };
            }

            const week = Math.ceil(dayIndex / 7);
            if (week < 5) {
                return {
                    dayIndex,
                    type: "training",
                    note: "",
                    actionSets: [
                        { type: "no-filter", actionId: "pullup-bottom", itemType: "STRENGTH", params: {} },
                        { type: "no-filter", actionId: "pullup-bottom", itemType: "STRENGTH", params: {} },
                        { type: "no-filter", actionId: "pullup-bottom", itemType: "STRENGTH", params: {} },
                        { type: "no-filter", actionId: "curl", itemType: "STRENGTH", params: {} },
                    ],
                };
            }

            return {
                dayIndex,
                type: "training",
                note: "",
                actionSets: [
                    { type: "no-filter", actionId: "pullup-bottom", itemType: "STRENGTH", params: {} },
                    { type: "no-filter", actionId: "pullup-top", itemType: "STRENGTH", params: {} },
                    { type: "no-filter", actionId: "pullup-bottom", itemType: "STRENGTH", params: {} },
                    { type: "no-filter", actionId: "curl", itemType: "STRENGTH", params: {} },
                ],
            };
        });

        const result = tryApplyDeterministicBatchEdit({
            instruction: "第5周到第15周 第一个训练日（D1）和 第2个训练日（D3）如果出现了3次负重引体 去掉第3次 其余保持不变",
            trainingDays,
            actions,
        });

        expect(result.matched).toBe(true);
        expect(result.applied).toBe(true);

        const week5Day1 = result.updatedTrainingDays.find((day: any) => day.dayIndex === 29);
        expect(week5Day1.actionSets).toHaveLength(3);
        expect(week5Day1.actionSets[0].actionId).toBe("pullup-bottom");
        expect(week5Day1.actionSets[1].actionId).toBe("pullup-top");
        expect(week5Day1.actionSets[2].actionId).toBe("curl");

        const week4Day1 = result.updatedTrainingDays.find((day: any) => day.dayIndex === 22);
        expect(week4Day1.actionSets).toHaveLength(4);
    });
});
