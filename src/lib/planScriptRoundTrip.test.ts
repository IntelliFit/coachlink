import { describe, expect, it } from "vitest";
import {
    formatTemplateToPlanScript,
    mergePlanScriptDayPatch,
    mergePlanScriptDayPatches,
    mergePlanScriptPlan,
    parsePlanScript,
} from "@/lib/planScript";

const actions = [
    { id: "squat", name: "杠铃深蹲", type: "STRENGTH" },
    { id: "bench", name: "杠铃卧推", type: "STRENGTH" },
    { id: "run", name: "跑步", type: "CARDIO" },
    { id: "row", name: "杠铃划船", type: "STRENGTH" },
] as any;
const actionNameById = Object.fromEntries(actions.map((action: any) => [action.id, action.name]));

const parse = (script: string) => parsePlanScript({ script, actions, allowPendingActions: true });
const format = (trainingDays: any[]) => formatTemplateToPlanScript({ trainingDays, actionNameById });

// 一个包含 PlanScript 写不出的字段的训练日
const richDay = () => ({
    id: "day-row-1",
    dayIndex: 1,
    type: "training",
    note: "主训练日\n注意热身",
    actionSets: [
        {
            type: "no-filter",
            actionId: "squat",
            setName: "动作1",
            itemType: "STRENGTH",
            params: {
                组数: 4,
                次数: 5,
                休息时间: 180,
                load: 100,
                intensityConfig: {
                    relativeIntensity: { type: "rm", value: 6 },
                    recommendedLoad: { value: 100, unit: "kg" },
                },
                note: "第一行\n第二行",
            },
        },
        {
            type: "no-filter",
            actionId: "bench",
            itemType: "STRENGTH",
            params: { 组数: 3, 次数: 8, 强度: "70%1RM", loadUnit: "kg" },
        },
        {
            type: "no-filter",
            actionId: "run",
            itemType: "CARDIO",
            params: { 距离: 5, 配速: "5:30", note: "" },
        },
        {
            actionId: "row",
            itemType: "STRENGTH",
            params: { 组数: 3, 次数: 10, weight: 50 },
        },
    ],
});

describe("PlanScript round trip (item 3)", () => {
    it("writes loads, units and string intensities the old formatter dropped", () => {
        const script = format([richDay()]);
        expect(script).toContain("杠铃深蹲 4x5 @6rm r180 #第一行\\n第二行");
        expect(script).toContain("杠铃卧推 3x8 @70%");
        expect(script).toContain("杠铃划船 3x10 @50kg");
        expect(script).toContain("!主训练日\\n注意热身");
    });

    it("parses pound loads", () => {
        const { days } = parse("W1\nD1\n杠铃卧推 5x5 @135lbs");
        expect((days[0].actionSets![0] as any).params).toMatchObject({
            load: 135,
            loadUnit: "lbs",
            intensityConfig: { fixedWeight: { value: 135, unit: "lbs" } },
        });
        expect(format(days)).toContain("杠铃卧推 5x5 @135lbs");
    });

    it("keeps a multi-line note as one note instead of a fake pending action", () => {
        const { days } = parse(format([richDay()]));
        const sets = days[0].actionSets as any[];
        expect(sets).toHaveLength(4);
        expect(sets.some((set) => String(set.actionId).startsWith("pending:"))).toBe(false);
        expect(sets[0].params.note).toBe("第一行\n第二行");
        expect(days[0].note).toBe("主训练日\n注意热身");
    });

    it("treats sets without a type as plain actions; only branch sets are refused", () => {
        expect(() => format([richDay()])).not.toThrow();
        const branchDay = {
            dayIndex: 1,
            type: "training",
            actionSets: [{ type: "one-filter", actions: [{ actionId: "squat", params: {} }] }],
        };
        expect(() => format([branchDay])).toThrow(/条件分支/);
    });

    it("restores every field when an unchanged day comes back from the model", () => {
        const original = richDay();
        const { days } = parse(format([original]));
        expect(mergePlanScriptDayPatch(original as any, days[0], actionNameById)).toEqual(original);
    });

    it("applies the edited token and keeps the fields the script cannot express", () => {
        const original = richDay();
        const edited = format([original])
            .replace("杠铃深蹲 4x5 @6rm r180", "杠铃深蹲 5x5 @5rm r180")
            .replace("杠铃划船 3x10 @50kg", "杠铃划船 3x10 @55kg");
        const merged = mergePlanScriptDayPatch(original as any, parse(edited).days[0], actionNameById) as any;

        expect(merged.id).toBe("day-row-1");
        expect(merged.actionSets[0].params).toMatchObject({
            组数: 5,
            次数: 5,
            休息时间: 180,
            note: "第一行\n第二行",
            intensityConfig: {
                relativeIntensity: { type: "rm", value: 5 },
                recommendedLoad: { value: 100, unit: "kg" },
            },
        });
        expect(merged.actionSets[0].setName).toBe("动作1");
        // 没改的动作原样保留
        expect(merged.actionSets[1]).toEqual(original.actionSets[1]);
        expect(merged.actionSets[2]).toEqual(original.actionSets[2]);
        // 改了固定重量：load 与旧字段 weight 一起更新
        expect(merged.actionSets[3].params).toMatchObject({ load: 55, weight: 55, 组数: 3, 次数: 10 });
    });

    it("keeps a literal backslash-n in a note", () => {
        const day = { dayIndex: 1, type: "training", note: "", actionSets: [
            { type: "no-filter", actionId: "squat", params: { 组数: 3, 次数: 5, note: "路径 C:\\new" } },
        ] };
        const { days } = parse(format([day]));
        expect((days[0].actionSets![0] as any).params.note).toBe("路径 C:\\new");
    });

    it("keeps the pound unit when only the RM changes", () => {
        const day = { dayIndex: 1, type: "training", note: "", actionSets: [
            { type: "no-filter", actionId: "bench", params: {
                组数: 3, 次数: 5, loadUnit: "lbs", 强度: 6,
                intensityConfig: { relativeIntensity: { type: "rm", value: 6 }, recommendedLoad: { value: 185, unit: "lbs" } },
            } },
        ] };
        const edited = format([day]).replace("@6rm", "@5rm");
        const merged = mergePlanScriptDayPatch(day as any, parse(edited).days[0], actionNameById) as any;
        expect(merged.actionSets[0].params).toMatchObject({
            loadUnit: "lbs",
            强度: 5,
            intensityConfig: { relativeIntensity: { type: "rm", value: 5 }, recommendedLoad: { value: 185, unit: "lbs" } },
        });
    });

    it("applies a whole edited script onto the plan for the script editors", () => {
        const original = richDay();
        const rest = { id: "day-row-2", dayIndex: 2, type: "rest", note: "", actionSets: [] };
        // 脚本里删掉了第 2 天、第 1 天原样保留
        const script = format([original]);
        const merged = mergePlanScriptPlan([original, rest] as any, parse(script).days, actionNameById);
        expect(merged).toEqual([original]);
    });

    it("uses the patch as-is for a replaced action and only patches matching days", () => {
        const original = richDay();
        const rest = { id: "day-row-2", dayIndex: 2, type: "rest", note: "", actionSets: [] };
        const edited = format([original]).replace("杠铃划船 3x10 @50kg", "跑步");
        const merged = mergePlanScriptDayPatches([original, rest] as any, parse(edited).days, actionNameById) as any[];
        expect(merged[0].actionSets[3]).toMatchObject({ actionId: "run", itemType: "CARDIO" });
        expect(merged[1]).toBe(rest);
    });
});
