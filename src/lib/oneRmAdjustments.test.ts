import { describe, expect, it } from "vitest";
import {
    normalizeOneRmDelta,
    resolveOneRmAdjustments,
} from "@/lib/oneRmAdjustments";

describe("normalizeOneRmDelta", () => {
    it("rounds every adjustment to 2.5kg increments", () => {
        expect(normalizeOneRmDelta(-1)).toBe(-2.5);
        expect(normalizeOneRmDelta(2.6)).toBe(2.5);
        expect(normalizeOneRmDelta(6)).toBe(5);
        expect(normalizeOneRmDelta(-8.1)).toBe(-7.5);
    });
});

describe("resolveOneRmAdjustments", () => {
    const actions = [
        { id: "coach-squat", name: "深蹲", canonical_action_id: "canon-squat" },
        { id: "coach-bench", name: "卧推", canonical_action_id: "canon-bench" },
    ];

    it("resolves by action name and computes next 1RM", () => {
        const result = resolveOneRmAdjustments({
            drafts: [{ actionName: "深蹲", deltaKg: -2.5, reason: "学员反馈太重" }],
            actions,
            currentOneRMByCanonicalActionId: { "canon-squat": 120 },
            studentActionIdByCanonicalActionId: { "canon-squat": "student-squat" },
        });

        expect(result).toEqual([
            {
                actionId: "coach-squat",
                actionName: "深蹲",
                canonicalActionId: "canon-squat",
                studentActionId: "student-squat",
                currentOneRM: 120,
                nextOneRM: 117.5,
                deltaKg: -2.5,
                reason: "学员反馈太重",
            },
        ]);
    });

    it("derives delta from target 1RM and combines duplicate adjustments", () => {
        const result = resolveOneRmAdjustments({
            drafts: [
                { actionName: "卧推", deltaKg: 2.5, reason: "太轻" },
                { actionName: "卧推", targetOneRM: 87.5, reason: "偏差较大" },
            ],
            actions,
            currentOneRMByActionName: { "卧推": 80 },
        });

        expect(result).toEqual([
            {
                actionId: "coach-bench",
                actionName: "卧推",
                canonicalActionId: "canon-bench",
                studentActionId: null,
                currentOneRM: 80,
                nextOneRM: 90,
                deltaKg: 10,
                reason: "太轻；偏差较大",
            },
        ]);
    });

    it("skips unresolved actions or actions without current 1RM baseline", () => {
        const result = resolveOneRmAdjustments({
            drafts: [
                { actionName: "不存在动作", deltaKg: -2.5 },
                { actionName: "深蹲", deltaKg: -2.5 },
            ],
            actions,
            currentOneRMByCanonicalActionId: {},
        });

        expect(result).toEqual([]);
    });
});
