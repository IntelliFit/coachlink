import { describe, expect, it } from "vitest";
import { findFirstLineForAction, lineHasExplicitReps } from "./planImportText";

describe("planImportText.lineHasExplicitReps", () => {
    it("detects classic sets×reps formats", () => {
        expect(lineHasExplicitReps("负重引体 4x4 @ 70% 1RM")).toBe(true);
        expect(lineHasExplicitReps("负重引体 4×4 @ 70% 1RM")).toBe(true);
        expect(lineHasExplicitReps("负重引体 4*4 @ 70% 1RM")).toBe(true);
    });

    it("detects CN-unit formats like '4 组 * 4 次'", () => {
        expect(lineHasExplicitReps("W1D1：正手负重引体 (70% 1RM) 4 组 * 4 次")).toBe(
            true,
        );
        expect(lineHasExplicitReps("正手负重引体 4组×4次")).toBe(true);
        expect(lineHasExplicitReps("正手负重引体 3组8次")).toBe(true);
    });

    it("detects '动作 * 5 次' single-reps style", () => {
        expect(lineHasExplicitReps("测试日：自重引体向上 * 5 次")).toBe(true);
    });

    it("does not treat RM-only as explicit reps", () => {
        expect(lineHasExplicitReps("负重引体 12RM")).toBe(false);
        expect(lineHasExplicitReps("负重引体 @ 5RM rpe9")).toBe(false);
    });

    it("does not treat timed-only lines as explicit reps", () => {
        expect(lineHasExplicitReps("单手悬挂交替 30s/30s")).toBe(false);
        expect(lineHasExplicitReps("顶部维持 3 秒 + 慢离心")).toBe(false);
    });
});

describe("planImportText.findFirstLineForAction", () => {
    it("prefers the detail line over a markdown heading with the same action name", () => {
        const text = `**负重臂屈伸**
* 负重臂屈伸 3组6次（使用8RM的重量）`;
        expect(findFirstLineForAction(text, "负重臂屈伸")).toBe(
            "* 负重臂屈伸 3组6次（使用8RM的重量）",
        );
    });
});

