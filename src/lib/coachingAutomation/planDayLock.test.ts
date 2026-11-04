import { describe, expect, it } from "vitest";
import { dayPrescriptionKey, hasTrainingDayChanges, mergeKeepingLockedDays } from "./planDayLock";

const day = (dayIndex: number, sets: Array<[string, Record<string, unknown>]>, extra: Record<string, unknown> = {}) => ({
    type: "training",
    dayIndex,
    actionSets: sets.map(([actionId, params]) => ({ type: "no-filter", actionId, params })),
    ...extra,
});

const original = [
    day(1, [["squat", { 组数: 5, 次数: 5, 强度: 5, load: 100 }]]),
    { type: "rest", dayIndex: 2 },
    day(3, [["bench", { 组数: 4, 次数: 6, 强度: 6, load: 70, setPrescriptions: [{ reps: 6 }] }]]),
    day(4, [["row", { 组数: 3, 次数: 10, 强度: "70%1RM" }]]),
];

describe("mergeKeepingLockedDays", () => {
    it("keeps trained days and days before the start day untouched", () => {
        const revised = [
            day(1, [["squat", { 组数: 3, 次数: 5, 强度: 5 }]]),
            { type: "rest", dayIndex: 2 },
            day(3, [["bench", { 组数: 3, 次数: 6, 强度: 6 }]]),
            day(4, [["row", { 组数: 3, 次数: 10, 强度: "70%1RM" }]]),
        ];
        const merged = mergeKeepingLockedDays({ originalDays: original, revisedDays: revised, lockedDayIndexes: [1] })!;
        expect(merged[0]).toBe(original[0]);
        expect(merged[2]).toEqual({ ...revised[2], dayIndex: 3 });

        const fromDay4 = mergeKeepingLockedDays({ originalDays: original, revisedDays: revised, lockedDayIndexes: [], startExecutionDay: 4 })!;
        expect(fromDay4.slice(0, 3)).toEqual(original.slice(0, 3));
    });

    it("keeps the original object when only computed loads or dropped fields differ", () => {
        const revised = [
            day(1, [["squat", { 组数: 5, 次数: 5, 强度: 5, load: 102.5 }]]),
            { type: "rest", dayIndex: 2 },
            day(3, [["bench", { 组数: 4, 次数: 6, 强度: 6 }]]),
            day(4, [["row", { 组数: 3, 次数: 10, intensityConfig: { relativeIntensity: { type: "percentage", value: 70 } } }]]),
        ];
        const merged = mergeKeepingLockedDays({ originalDays: original, revisedDays: revised, lockedDayIndexes: [] })!;
        merged.forEach((d, i) => expect(d).toBe(original[i]));
        expect(hasTrainingDayChanges(original, merged)).toBe(false);
    });

    it("rejects a revision with a different number of days", () => {
        expect(mergeKeepingLockedDays({ originalDays: original, revisedDays: original.slice(0, 3), lockedDayIndexes: [] })).toBeNull();
    });

    it("with base keys, keeps the coach's later edits on days the draft did not change", () => {
        const base = original;
        const draft = [
            base[0],
            base[1],
            day(3, [["bench", { 组数: 3, 次数: 8, 强度: 8 }]]),
            base[3],
        ];
        const coachEdited = [
            base[0],
            base[1],
            base[2],
            day(4, [["row", { 组数: 4, 次数: 8, 强度: 8 }]]),
        ];
        const merged = mergeKeepingLockedDays({
            originalDays: coachEdited,
            revisedDays: draft,
            lockedDayIndexes: [],
            baseDayKeys: base.map(dayPrescriptionKey),
        })!;
        expect(merged[2]).toEqual({ ...draft[2], dayIndex: 3 });
        expect(merged[3]).toBe(coachEdited[3]);
    });
});
