import { describe, expect, it } from "vitest";
import {
    analyzeModifications,
    buildVmActionCatalog,
    describeNoChangeTurn,
    findUnresolvedOneRmDrafts,
    normalizeStrengthParamsForEditor,
    normalizeTrainingDaysForEditor,
    trainingDaysFingerprint,
} from "@/lib/planAssistantEdits";

const actions = [
    { id: "squat", name: "杠铃深蹲", type: "STRENGTH" },
    { id: "run", name: "跑步", type: "CARDIO" },
    { id: "plank", name: "平板支撑", type: "STRENGTH" },
];

const strengthDay = (params: Record<string, any>, extra: Record<string, any> = {}) => ({
    dayIndex: 1,
    type: "training",
    note: "",
    actionSets: [{ type: "no-filter", actionId: "squat", itemType: "STRENGTH", params, ...extra }],
});

describe("code engine action types (item 1)", () => {
    it("gives the sandbox catalog each action's library type", () => {
        expect(buildVmActionCatalog(actions)).toEqual([
            { id: "squat", name: "杠铃深蹲", type: "STRENGTH" },
            { id: "run", name: "跑步", type: "CARDIO" },
            { id: "plank", name: "平板支撑", type: "STRENGTH" },
        ]);
    });

    it("corrects a STRENGTH itemType the model left on a set swapped to running", () => {
        const swapped = [{
            dayIndex: 1,
            type: "training",
            actionSets: [{ type: "no-filter", actionId: "run", itemType: "STRENGTH", params: { 距离: 5 } }],
        }];
        const [day] = normalizeTrainingDaysForEditor(swapped, actions, [strengthDay({ 组数: 4 })]);
        expect(day.actionSets[0].itemType).toBe("CARDIO");
        // 有氧参数不会被塞进力量参数的规范化
        expect(day.actionSets[0].params).toEqual({ 距离: 5 });
    });

    it("keeps the model's type for pending actions and fills a missing set type", () => {
        const days = [{
            dayIndex: 1,
            type: "training",
            actionSets: [{ actionId: "pending:跳绳", itemType: "CARDIO", params: { action_name: "跳绳" } }],
        }];
        const [day] = normalizeTrainingDaysForEditor(days, actions);
        expect(day.actionSets[0]).toMatchObject({ type: "no-filter", itemType: "CARDIO" });
    });
});

describe("Chinese parameter keys (item 2)", () => {
    it("reports set, rep and rest edits stored under the Chinese keys", () => {
        const original = [strengthDay({ 组数: 4, 次数: 6, 休息时间: 180 })];
        const updated = [strengthDay({ 组数: 5, 次数: 5, 休息时间: 150 })];
        const diff = analyzeModifications(original, updated, actions);
        expect(diff.map((item) => [item.field, item.oldValue, item.newValue])).toEqual([
            ["组数", "4", "5"],
            ["次数", "6", "5"],
            ["休息时间", "180秒", "150秒"],
        ]);
        expect(diff[0]).toMatchObject({ dayIndex: 1, actionName: "杠铃深蹲" });
    });

    it("lets an English key the model just wrote override the stale Chinese value", () => {
        const previous = { 组数: 4, 次数: 6, 休息时间: 180 };
        const written = { ...previous, sets: 5, rest_seconds: 120 };
        expect(normalizeStrengthParamsForEditor(written, previous)).toEqual({ 组数: 5, 次数: 6, 休息时间: 120 });
    });

    it("does not let an unchanged legacy English key undo a newer Chinese edit", () => {
        const previous = { 组数: 4, sets: 4 };
        const written = { 组数: 6, sets: 4 };
        expect(normalizeStrengthParamsForEditor(written, previous)).toEqual({ 组数: 6 });
    });

    it("keeps weight in step with load", () => {
        const previous = { load: 60, weight: 60 };
        expect(normalizeStrengthParamsForEditor({ load: 60, weight: 65 }, previous)).toMatchObject({ load: 65, weight: 65 });
    });

    it("shows a real edit after the model wrote English keys into a Chinese-key plan", () => {
        const original = [strengthDay({ 组数: 4, 次数: 6 })];
        const modelOutput = [strengthDay({ 组数: 4, 次数: 6, sets: 3 })];
        const normalized = normalizeTrainingDaysForEditor(modelOutput, actions, original);
        const diff = analyzeModifications(original, normalized, actions);
        expect(diff).toEqual([
            { dayIndex: 1, actionName: "杠铃深蹲", field: "组数", oldValue: "4", newValue: "3" },
        ]);
        expect(normalized[0].actionSets[0].params.sets).toBeUndefined();
    });

    it("reports no change when only the key spelling changed", () => {
        const original = [strengthDay({ sets: 4, reps: 6 })];
        const normalized = normalizeTrainingDaysForEditor(original, actions, original);
        expect(analyzeModifications(original, normalized, actions)).toEqual([]);
    });

    it("shows no change for untouched branch sets and legacy fixed weights once both sides are normalized", () => {
        const original = [{
            dayIndex: 1,
            type: "training",
            actionSets: [
                // Web 编辑器创建的条件分支里，动作没有 itemType
                { type: "one-filter", actions: [{ actionId: "squat", params: { 组数: 3, weight: 60 } }] },
                { type: "no-filter", actionId: "squat", params: { 组数: 4, fixedWeight: 60 } },
            ],
        }];
        const normalizedOriginal = normalizeTrainingDaysForEditor(original, actions, original);
        const normalizedResult = normalizeTrainingDaysForEditor(JSON.parse(JSON.stringify(original)), actions, original);
        expect(analyzeModifications(normalizedOriginal, normalizedResult, actions)).toEqual([]);
        // 只规范化一边时才会出现假的变化，这正是 route 里两边都规范化的原因
        expect(analyzeModifications(original, normalizedResult, actions).length).toBeGreaterThan(0);
    });

    it("keeps text rep and rest values instead of dropping them", () => {
        expect(normalizeStrengthParamsForEditor({ 组数: 3, reps: "8-12", rest_seconds: "90-120" }, {}))
            .toEqual({ 组数: 3, 次数: "8-12", 休息时间: "90-120" });
        const original = [strengthDay({ 组数: 3, 次数: 10 })];
        const updated = normalizeTrainingDaysForEditor([strengthDay({ 组数: 3, 次数: 10, reps: "8-12" })], actions, original);
        expect(analyzeModifications(original, updated, actions)).toEqual([
            { dayIndex: 1, actionName: "杠铃深蹲", field: "次数", oldValue: "10", newValue: "8-12" },
        ]);
    });

    it("matches the previous version of a set by action after an earlier set was deleted", () => {
        const previous = [{
            dayIndex: 1,
            type: "training",
            actionSets: [
                { type: "no-filter", actionId: "plank", params: { 组数: 3 } },
                { type: "no-filter", actionId: "squat", params: { 组数: 5, sets: 4 } },
            ],
        }];
        // 删掉第一个动作后，深蹲移到第 0 位；遗留的 sets:4 不能盖过 组数:5
        const result = [{ dayIndex: 1, type: "training", actionSets: [previous[0].actionSets[1]] }];
        const [day] = normalizeTrainingDaysForEditor(result, actions, previous);
        expect(day.actionSets[0].params).toEqual({ 组数: 5 });
    });

    it("diffs cardio parameters by key", () => {
        const cardio = (distance: number) => [{
            dayIndex: 2,
            type: "training",
            actionSets: [{ type: "no-filter", actionId: "run", itemType: "CARDIO", params: { 距离: distance } }],
        }];
        expect(analyzeModifications(cardio(3), cardio(5), actions)).toEqual([
            { dayIndex: 2, actionName: "跑步", field: "距离", oldValue: 3, newValue: 5 },
        ]);
    });

    it("aligns days by dayIndex rather than array position", () => {
        const original = [strengthDay({ 组数: 4 }), { dayIndex: 2, type: "rest", actionSets: [] }];
        const updated = [{ dayIndex: 2, type: "rest", actionSets: [] }, strengthDay({ 组数: 4 })];
        expect(analyzeModifications(original, updated, actions)).toEqual([]);
    });
});

describe("turns that change nothing (item 5)", () => {
    it("does not count an unresolved 1RM draft as a change", () => {
        const unresolved = findUnresolvedOneRmDrafts([{ actionName: "杠铃深蹲", deltaKg: -2.5 }], []);
        expect(unresolved).toEqual(["杠铃深蹲"]);
        const message = describeNoChangeTurn({
            modificationCount: 0,
            resolvedOneRmCount: 0,
            unresolvedOneRmNames: unresolved,
            hasOneRmSubject: true,
        });
        expect(message).toContain("本轮没有产生实际修改");
        expect(message).toContain("杠铃深蹲");
    });

    it("explains that a template has no student 1RM to adjust", () => {
        const message = describeNoChangeTurn({
            modificationCount: 0,
            resolvedOneRmCount: 0,
            unresolvedOneRmNames: ["杠铃深蹲"],
            hasOneRmSubject: false,
        });
        expect(message).toContain("没有关联学员");
    });

    it("lets a turn with a resolved 1RM change through", () => {
        expect(describeNoChangeTurn({ modificationCount: 0, resolvedOneRmCount: 1 })).toBeNull();
        expect(findUnresolvedOneRmDrafts(
            [{ actionName: "杠铃深蹲", deltaKg: -2.5 }],
            [{ actionId: "squat", actionName: "杠铃深蹲" }],
        )).toEqual([]);
    });

    it("returns a generic message when nothing changed at all", () => {
        expect(describeNoChangeTurn({ modificationCount: 0, resolvedOneRmCount: 0 })).toContain("写得更明确");
    });
});

describe("trainingDaysFingerprint", () => {
    it("ignores key order but not values", () => {
        const a = [{ dayIndex: 1, type: "training", actionSets: [{ actionId: "x", params: { 组数: 4, 次数: 5 } }] }];
        const b = [{ actionSets: [{ params: { 次数: 5, 组数: 4 }, actionId: "x" }], type: "training", dayIndex: 1 }];
        const c = [{ dayIndex: 1, type: "training", actionSets: [{ actionId: "x", params: { 组数: 5, 次数: 5 } }] }];
        expect(trainingDaysFingerprint(a)).toBe(trainingDaysFingerprint(b));
        expect(trainingDaysFingerprint(a)).not.toBe(trainingDaysFingerprint(c));
    });
});
