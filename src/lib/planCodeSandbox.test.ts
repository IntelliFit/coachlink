import { describe, expect, it } from "vitest";
import { executeCodeInVM } from "@/lib/planCodeSandbox";

const actions = [
    { id: "squat", name: "杠铃深蹲", type: "STRENGTH" },
    { id: "run", name: "跑步", type: "CARDIO" },
];

const plan = [{
    dayIndex: 1,
    type: "training",
    actionSets: [{ type: "no-filter", actionId: "squat", itemType: "STRENGTH", params: { 组数: 4, 次数: 5 } }],
}];

describe("executeCodeInVM", () => {
    it("lets generated code read an action's type, so a lift swapped to running becomes CARDIO", async () => {
        // 与提示词要求的写法一致：itemType = findActionById(id)?.type || 'STRENGTH'
        const code = `
            const run = findActionByName('跑步');
            for (const day of trainingDays) {
                for (const set of day.actionSets || []) {
                    if (set.actionId === 'squat') {
                        set.actionId = run.id;
                        set.itemType = findActionById(run.id)?.type || 'STRENGTH';
                        set.params = { 距离: 5 };
                    }
                }
            }
        `;
        const result = await executeCodeInVM(code, plan, actions);
        expect(result.success).toBe(true);
        expect(result.result[0].actionSets[0]).toMatchObject({ actionId: "run", itemType: "CARDIO" });
    });

    it("reports a failure instead of throwing when the code is broken", async () => {
        const result = await executeCodeInVM("this is not javascript(", plan, actions);
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
    });
});
