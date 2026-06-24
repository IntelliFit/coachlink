import { describe, expect, it } from "vitest";
import { applyLoadAdjustments } from "./loadAdjustments";

const actions = [
    { id: "bench-1", name: "杠铃卧推" },
    { id: "pullup-1", name: "负重引体" },
];

describe("applyLoadAdjustments", () => {
    it("applies fixed load by action name and rounds to 2.5kg steps", () => {
        const trainingDays = [
            {
                dayIndex: 1,
                type: "training",
                actionSets: [
                    {
                        actionId: "bench-1",
                        itemType: "STRENGTH",
                        params: {
                            load: 57.5,
                            intensityConfig: {
                                relativeIntensity: { type: "rm", value: 6 },
                            },
                        },
                    },
                ],
            },
        ];

        const result = applyLoadAdjustments({
            drafts: [
                {
                    actionName: "杠铃卧推",
                    mode: "fixed",
                    targetKg: 61,
                    reason: "问卷已知工作重量",
                },
            ],
            trainingDays,
            actions,
        });

        expect(result.adjustments).toHaveLength(1);
        expect(result.adjustments[0].nextLoadKg).toBe(60);
        expect(result.updatedTrainingDays[0].actionSets[0].params.load).toBe(60);
        expect(result.updatedTrainingDays[0].actionSets[0].params.weight).toBe(60);
        expect(result.updatedTrainingDays[0].actionSets[0].params.intensityConfig).toEqual({
            fixedWeight: { value: 60, unit: "kg" },
        });
        expect(result.updatedTrainingDays[0].actionSets[0].params["强度"]).toBeUndefined();
    });

    it("applies delta load to only the targeted matched set", () => {
        const trainingDays = [
            {
                dayIndex: 3,
                type: "training",
                actionSets: [
                    {
                        actionId: "pullup-1",
                        itemType: "STRENGTH",
                        params: { load: 15 },
                    },
                    {
                        actionId: "pullup-1",
                        itemType: "STRENGTH",
                        params: { load: 20 },
                    },
                ],
            },
        ];

        const result = applyLoadAdjustments({
            drafts: [
                {
                    actionId: "pullup-1",
                    dayIndex: 3,
                    setIndex: 2,
                    mode: "fixed_weight",
                    deltaKg: -2.5,
                },
            ],
            trainingDays,
            actions,
        });

        expect(result.adjustments).toHaveLength(1);
        expect(result.adjustments[0].dayIndex).toBe(3);
        expect(result.adjustments[0].setIndex).toBe(2);
        expect(result.updatedTrainingDays[0].actionSets[0].params.load).toBe(15);
        expect(result.updatedTrainingDays[0].actionSets[1].params.load).toBe(17.5);
    });

    it("applies structured RM and percentage changes without requiring full script rewrite", () => {
        const trainingDays = [
            {
                dayIndex: 1,
                type: "training",
                actionSets: [
                    {
                        actionId: "bench-1",
                        itemType: "STRENGTH",
                        params: {
                            load: 80,
                            intensityConfig: {
                                fixedWeight: { value: 80, unit: "kg" },
                            },
                        },
                    },
                ],
            },
            {
                dayIndex: 2,
                type: "training",
                actionSets: [
                    {
                        actionId: "pullup-1",
                        itemType: "STRENGTH",
                        params: {
                            load: 10,
                            intensityConfig: {
                                relativeIntensity: { type: "rm", value: 5 },
                                recommendedLoad: { value: 10, unit: "kg" },
                            },
                            强度: 5,
                        },
                    },
                ],
            },
        ];

        const result = applyLoadAdjustments({
            drafts: [
                {
                    actionId: "bench-1",
                    mode: "rm",
                    targetValue: 8,
                },
                {
                    actionName: "负重引体",
                    mode: "percentage",
                    targetValue: 72.5,
                },
            ],
            trainingDays,
            actions,
        });

        expect(result.adjustments).toHaveLength(2);
        expect(result.updatedTrainingDays[0].actionSets[0].params.intensityConfig).toEqual({
            relativeIntensity: { type: "rm", value: 8 },
            recommendedLoad: { value: 80, unit: "kg" },
        });
        expect(result.updatedTrainingDays[0].actionSets[0].params["强度"]).toBe(8);
        expect(result.updatedTrainingDays[1].actionSets[0].params.intensityConfig).toEqual({
            relativeIntensity: { type: "percentage", value: 72.5 },
            recommendedLoad: { value: 10, unit: "kg" },
        });
        expect(result.updatedTrainingDays[1].actionSets[0].params["强度"]).toBeUndefined();
    });
});
