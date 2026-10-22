import { describe, expect, it } from "vitest";
import {
    buildCoachOnboardingProgress,
    hasCoachPackage,
    resolveHuifuAccountState,
} from "./coachOnboardingProgress";

const empty = { questionnaireCount: 0, templateCount: 0, activeStudentCount: 0 };

describe("resolveHuifuAccountState", () => {
    it("treats a saved card token as opened", () => {
        expect(resolveHuifuAccountState({ huifuCardToken: "tok", huifuId: "6666" })).toBe("opened");
    });

    it("treats huifu_id or apply_no without a token as still reviewing", () => {
        expect(resolveHuifuAccountState({ huifuId: "6666" })).toBe("reviewing");
        expect(resolveHuifuAccountState({ huifuApplyNo: "A1" })).toBe("reviewing");
    });

    it("treats blank values as not opened", () => {
        expect(resolveHuifuAccountState({ huifuCardToken: "  ", huifuId: null })).toBe("none");
    });
});

describe("hasCoachPackage", () => {
    it("accepts new products or legacy pricings", () => {
        expect(hasCoachPackage({ products: [{ id: "p1" }] })).toBe(true);
        expect(hasCoachPackage({ products: [], pricings: [{ title: "月卡" }] })).toBe(true);
    });

    it("rejects missing or empty pricing", () => {
        expect(hasCoachPackage(null)).toBe(false);
        expect(hasCoachPackage({ products: [], pricings: [] })).toBe(false);
        expect(hasCoachPackage({ products: {} })).toBe(false);
    });
});

describe("buildCoachOnboardingProgress", () => {
    it("starts a freshly approved coach in setup with nothing done", () => {
        const progress = buildCoachOnboardingProgress(empty);
        expect(progress.stage).toBe("setup");
        expect(progress.completed).toBe(0);
        expect(progress.total).toBe(4);
        expect(progress.huifuAccount).toBe("none");
    });

    it("marks a coach ready once all four steps are done", () => {
        const progress = buildCoachOnboardingProgress({
            huifuCardToken: "tok",
            pricing: { products: [{ id: "p1" }] },
            questionnaireCount: 1,
            templateCount: 2,
            activeStudentCount: 0,
        });
        expect(progress.completed).toBe(4);
        expect(progress.stage).toBe("ready");
    });

    it("counts a coach with active students as serving even if setup is incomplete", () => {
        const progress = buildCoachOnboardingProgress({ ...empty, activeStudentCount: 3 });
        expect(progress.stage).toBe("serving");
        expect(progress.completed).toBe(0);
    });

    it("does not count a reviewing Huifu account as done", () => {
        const progress = buildCoachOnboardingProgress({ ...empty, huifuId: "6666" });
        expect(progress.huifuAccount).toBe("reviewing");
        expect(progress.steps.find((step) => step.key === "payment_account")?.done).toBe(false);
    });
});
