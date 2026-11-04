import { describe, expect, it } from "vitest";
import {
    buildOneRmUpdates,
    describeAiPlanAssistantTurn,
    interpretBatchOperationMessages,
    mergeOneRmAdjustments,
    parseBatchOperationMessages,
} from "../apps/wechat/src/services/coach/aiPlanAssistant";

const sse = (...messages: any[]) => messages.map((message) => `data: ${JSON.stringify(message)}\n\n`).join("");

const squatOneRm = {
    actionId: "coach-squat",
    actionName: "杠铃深蹲",
    canonicalActionId: "canon-squat",
    studentActionId: null,
    currentOneRM: 140,
    nextOneRM: 137.5,
    deltaKg: -2.5,
};

describe("mini-program AI plan assistant (item 6)", () => {
    it("keeps the 1RM adjustments and the assistant summary from a preview", () => {
        const messages = parseBatchOperationMessages(sse(
            { type: "progress", message: "正在分析" },
            { type: "assistant_message", content: "已生成新的预览草稿" },
            {
                type: "preview_result",
                success: true,
                originalTrainingDays: [{ dayIndex: 1 }],
                updatedTrainingDays: [{ dayIndex: 1, type: "training", actionSets: [] }],
                modifications: [{ dayIndex: 1, field: "组数" }],
                oneRmAdjustments: [squatOneRm],
                restoredLockedDayIndexes: [1],
                message: "脚本编辑完成",
            },
        ));
        const result = interpretBatchOperationMessages(messages);
        expect(result.kind).toBe("preview");
        if (result.kind !== "preview") return;
        expect(result.oneRmAdjustments).toEqual([squatOneRm]);
        expect(result.restoredLockedDayIndexes).toEqual([1]);
        expect(describeAiPlanAssistantTurn(result)).toBe("已生成新的预览草稿");
    });

    it("returns a clarification instead of failing", () => {
        const result = interpretBatchOperationMessages(parseBatchOperationMessages(sse(
            { type: "need_clarification", question: "要换成哪种有氧？", suggestions: ["跑步", "跳绳", 3] },
        )));
        expect(result).toEqual({ kind: "clarification", question: "要换成哪种有氧？", suggestions: ["跑步", "跳绳"] });
    });

    it("returns a query answer", () => {
        const result = interpretBatchOperationMessages(parseBatchOperationMessages(sse(
            { type: "query_result", answer: "第 2 周共 12 组深蹲" },
        )));
        expect(result).toEqual({ kind: "answer", answer: "第 2 周共 12 组深蹲" });
    });

    it("surfaces server errors and unconfirmed new actions", () => {
        expect(() => interpretBatchOperationMessages([{ type: "error", message: "模型超时" }])).toThrow("模型超时");
        expect(() => interpretBatchOperationMessages([{
            type: "preview_result",
            updatedTrainingDays: [],
            pendingActions: [{ tempActionId: "pending:跳绳" }],
        }])).toThrow(/Web 端完成动作确认/);
        expect(() => interpretBatchOperationMessages([])).toThrow(/暂未返回/);
    });

    it("maps 1RM adjustments to the student's actions by id, canonical id, then name", () => {
        const { updates, unresolved } = buildOneRmUpdates(
            [
                squatOneRm,
                { ...squatOneRm, actionId: "coach-bench", actionName: "杠铃卧推", canonicalActionId: null, nextOneRM: 92.5 },
                { ...squatOneRm, actionId: "coach-row", actionName: "杠铃划船", canonicalActionId: null, nextOneRM: 80 },
                { ...squatOneRm, actionId: "coach-dip", actionName: "负重臂屈伸", studentActionId: "student-dip", nextOneRM: 40 },
            ],
            [
                { id: "student-squat", name: "深蹲", canonical_action_id: "canon-squat" },
                { id: "student-bench", name: "杠铃卧推", canonical_action_id: null },
                { id: "student-dip", name: "双杠臂屈伸", canonical_action_id: null },
            ],
        );
        expect(updates).toEqual([
            { actionId: "student-squat", reference_1rm: 137.5 },
            { actionId: "student-bench", reference_1rm: 92.5 },
            { actionId: "student-dip", reference_1rm: 40 },
        ]);
        expect(unresolved.map((item) => item.actionName)).toEqual(["杠铃划船"]);
    });

    it("keeps earlier turns' 1RM changes and lets the newest win per action", () => {
        const merged = mergeOneRmAdjustments(
            [squatOneRm, { ...squatOneRm, actionId: "coach-bench", actionName: "杠铃卧推" }],
            [{ ...squatOneRm, nextOneRM: 135 }],
        );
        expect(merged.map((item) => [item.actionId, item.nextOneRM])).toEqual([
            ["coach-squat", 135],
            ["coach-bench", 137.5],
        ]);
    });
});
