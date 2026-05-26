import { describe, expect, it } from "vitest";
import {
    hasRunnableCoachPlan,
    shouldShowCoachPlanCompletedState,
} from "./todayTrainingPlanState";

describe("today training coach plan state", () => {
    it("does not treat a historical plan marker as completed without explicit completed state", () => {
        const state = {
            instance: null,
            accessStatus: "load_failed" as const,
        };

        expect(hasRunnableCoachPlan(state)).toBe(false);
        expect(shouldShowCoachPlanCompletedState(state)).toBe(false);
    });

    it("only shows completed state for an explicit completed plan status", () => {
        const state = {
            instance: { id: "plan-1" },
            accessStatus: "plan_completed" as const,
        };

        expect(hasRunnableCoachPlan(state)).toBe(false);
        expect(shouldShowCoachPlanCompletedState(state)).toBe(true);
    });

    it("keeps an active loaded plan runnable", () => {
        const state = {
            instance: { id: "plan-1" },
            accessStatus: "available" as const,
        };

        expect(hasRunnableCoachPlan(state)).toBe(true);
        expect(shouldShowCoachPlanCompletedState(state)).toBe(false);
    });
});

