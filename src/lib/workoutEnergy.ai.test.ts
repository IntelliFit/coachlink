import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const llm = vi.hoisted(() => ({
    model: "deepseek-v4.1-flash-1017",
    create: vi.fn(),
}));

vi.mock("@/lib/coachlinkLlm", () => ({
    getCoachlinkFastLlm: () => ({
        client: { chat: { completions: { create: llm.create } } },
        model: llm.model,
    }),
}));

import { estimateWorkoutEnergy, type WorkoutEnergyActionInput } from "./workoutEnergy";

const SQUAT: WorkoutEnergyActionInput = { actionId: "a-squat", name: "杠铃深蹲", type: "STRENGTH", completedSets: 4 };
const ROPE: WorkoutEnergyActionInput = {
    actionId: "a-rope",
    name: "跳绳",
    type: "CARDIO",
    completedSets: 1,
    actualDurationSeconds: 600,
};
const LIBRARY_PULL_UP: WorkoutEnergyActionInput = {
    actionId: "a-pull",
    name: "引体向上",
    type: "STRENGTH",
    completedSets: 3,
    itemSchema: { met: 6.5 },
};

function reply(content: string) {
    return { choices: [{ message: { content } }] };
}

function estimate(actions: WorkoutEnergyActionInput[]) {
    return estimateWorkoutEnergy({ bodyWeightKg: 70, elapsedMinutes: 30, actions });
}

describe("workout energy AI classification", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        llm.model = "deepseek-v4.1-flash-1017";
        llm.create.mockReset();
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it("turns thinking off for a deepseek fast model and keeps the abort signal", async () => {
        llm.create.mockResolvedValue(reply('{"actions":[{"index":0,"met":5.2,"confidence":"medium","reason":"深蹲"}]}'));

        await estimate([SQUAT]);

        const [body, options] = llm.create.mock.calls[0];
        expect(body.thinking).toEqual({ type: "disabled" });
        expect(body.enable_thinking).toBeUndefined();
        expect(options?.signal).toBeInstanceOf(AbortSignal);
    });

    it("uses enable_thinking false for a qwen fast model", async () => {
        llm.model = "qwen3.8-flash";
        llm.create.mockResolvedValue(reply('{"actions":[{"index":0,"met":5.2,"confidence":"medium","reason":"深蹲"}]}'));

        await estimate([SQUAT]);

        const [body] = llm.create.mock.calls[0];
        expect(body.enable_thinking).toBe(false);
        expect(body.thinking).toBeUndefined();
    });

    it("reads JSON wrapped in a markdown fence with text around it", async () => {
        llm.create.mockResolvedValue(reply(
            '好的，结果如下：\n```json\n{"actions":[{"index":0,"met":4.2,"confidence":"high","reason":"中等强度深蹲"}]}\n```',
        ));

        const result = await estimate([SQUAT]);

        expect(result?.method).toBe("ai_assisted_2024_compendium");
        expect(result?.actions[0].met).toBe(4.2);
        expect(result?.actions[0].basis).toBe("中等强度深蹲");
    });

    it("accepts met_value and MET as the MET key", async () => {
        llm.create.mockResolvedValue(reply(
            '{"actions":[{"index":0,"met_value":4.5,"confidence":"medium"},{"index":1,"MET":11.5,"confidence":"high"}]}',
        ));

        const result = await estimate([SQUAT, ROPE]);

        expect(result?.actions.map((item) => item.met)).toEqual([4.5, 11.5]);
    });

    it("turns an unknown confidence into low and shortens a long reason", async () => {
        llm.create.mockResolvedValue(reply(JSON.stringify({
            actions: [{ index: 0, met: 5, confidence: "very high", reason: "深蹲".repeat(100) }],
        })));

        const result = await estimate([SQUAT]);

        expect(result?.actions[0].confidence).toBe("low");
        expect(result?.confidence).toBe("low");
        expect(result?.actions[0].basis.length).toBeLessThanOrEqual(40);
    });

    it("uses the rule basis when the reason is not a string", async () => {
        llm.create.mockResolvedValue(reply('{"actions":[{"index":0,"met":5,"confidence":"medium","reason":{"text":"x"}}]}'));

        const result = await estimate([SQUAT]);

        expect(result?.actions[0].met).toBe(5);
        expect(result?.actions[0].basis).toBe("高强度力量");
    });

    it("falls back to the rules when the gateway answers with the response_format object", async () => {
        llm.create.mockResolvedValue(reply('{"type":"json_object"}'));

        const result = await estimate([SQUAT]);

        expect(result?.method).toBe("rules_2024_compendium");
        expect(result?.actions[0].met).toBe(5);
    });

    it("ignores entries with an unknown index, a repeated index or a non-positive MET", async () => {
        llm.create.mockResolvedValue(reply(JSON.stringify({
            actions: [
                { index: 7, met: 9 },
                { index: -1, met: 9 },
                { index: 0, met: 0 },
                { index: 1, met: "fast" },
                { index: 1, met: 10, confidence: "high", reason: "跳绳" },
                { index: 1, met: 3, confidence: "high", reason: "重复" },
            ],
        })));

        const result = await estimate([SQUAT, ROPE]);

        expect(result?.actions.map((item) => item.met)).toEqual([5, 10]);
        expect(result?.actions[1].basis).toBe("跳绳");
    });

    it("keeps the action-library MET and only asks the AI about the other actions", async () => {
        llm.create.mockResolvedValue(reply(JSON.stringify({
            actions: [
                { index: 0, met: 4.8, confidence: "medium", reason: "深蹲" },
                { index: 1, met: 3.0, confidence: "high", reason: "不该覆盖动作库" },
            ],
        })));

        const result = await estimate([SQUAT, LIBRARY_PULL_UP]);

        const sent = JSON.parse(llm.create.mock.calls[0][0].messages[1].content);
        expect(sent.map((item: { index: number }) => item.index)).toEqual([0]);
        expect(result?.actions[1].met).toBe(6.5);
        expect(result?.actions[1].basis).toBe("动作库MET");
        expect(result?.actions[0].met).toBe(4.8);
    });

    it("does not call the AI when every action has an action-library MET", async () => {
        const result = await estimate([LIBRARY_PULL_UP]);

        expect(llm.create).not.toHaveBeenCalled();
        expect(result?.actions[0].met).toBe(6.5);
        expect(result?.method).toBe("rules_2024_compendium");
    });

    it("falls back to the rules and warns when the model call is aborted", async () => {
        llm.create.mockRejectedValue(Object.assign(new Error("Request was aborted."), { name: "AbortError" }));

        const result = await estimate([SQUAT, ROPE]);

        expect(result?.method).toBe("rules_2024_compendium");
        expect(result?.actions.map((item) => item.met)).toEqual([5, 11]);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(String(warnSpy.mock.calls[0]?.[0])).toContain("[workout-energy]");
    });
});
