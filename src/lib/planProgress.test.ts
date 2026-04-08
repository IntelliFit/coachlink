import { describe, expect, it } from "vitest";
import { deriveStrictSequentialProgressDay } from "./planProgress";

const buildPlanDays = (withRestTask = false) => [
    { dayIndex: 1, type: "training" },
    { dayIndex: 2, type: "training" },
    { dayIndex: 3, type: "training" },
    {
        dayIndex: 4,
        type: "rest",
        actionSets: withRestTask
            ? [{ actionId: "diet-1", itemType: "DIET" }]
            : [],
    },
    { dayIndex: 5, type: "training" },
];

describe("planProgress (strict sequential pointer)", () => {
    it("points to day 4 rest after completing day 3", () => {
        const result = deriveStrictSequentialProgressDay({
            planDays: buildPlanDays(false),
            startExecutionDay: 1,
            executionsByDayIndex: {
                1: { status: "completed", completed_at: "2026-04-01T09:00:00.000Z" },
                2: { status: "completed", completed_at: "2026-04-02T09:00:00.000Z" },
                3: { status: "completed", completed_at: "2026-04-03T09:00:00.000Z" },
            },
            explicitStartDate: "2026-04-01T00:00:00.000Z",
            today: new Date("2026-04-03T12:00:00.000Z"),
        });

        expect(result.recommendedDayIndex).toBe(4);
    });

    it("auto-advances rest day without tasks on next day", () => {
        const result = deriveStrictSequentialProgressDay({
            planDays: buildPlanDays(false),
            startExecutionDay: 1,
            executionsByDayIndex: {
                1: { status: "completed", completed_at: "2026-04-01T09:00:00.000Z" },
                2: { status: "completed", completed_at: "2026-04-02T09:00:00.000Z" },
                3: { status: "completed", completed_at: "2026-04-03T09:00:00.000Z" },
            },
            explicitStartDate: "2026-04-01T00:00:00.000Z",
            today: new Date("2026-04-04T12:00:00.000Z"),
        });

        expect(result.recommendedDayIndex).toBe(5);
    });

    it("keeps pointer on rest day with lightweight tasks until resolved", () => {
        const unresolved = deriveStrictSequentialProgressDay({
            planDays: buildPlanDays(true),
            startExecutionDay: 1,
            executionsByDayIndex: {
                1: { status: "completed", completed_at: "2026-04-01T09:00:00.000Z" },
                2: { status: "completed", completed_at: "2026-04-02T09:00:00.000Z" },
                3: { status: "completed", completed_at: "2026-04-03T09:00:00.000Z" },
            },
            actionsMap: {
                "diet-1": { type: "DIET" },
            },
            explicitStartDate: "2026-04-01T00:00:00.000Z",
            today: new Date("2026-04-05T12:00:00.000Z"),
        });

        expect(unresolved.recommendedDayIndex).toBe(4);

        const resolved = deriveStrictSequentialProgressDay({
            planDays: buildPlanDays(true),
            startExecutionDay: 1,
            executionsByDayIndex: {
                1: { status: "completed", completed_at: "2026-04-01T09:00:00.000Z" },
                2: { status: "completed", completed_at: "2026-04-02T09:00:00.000Z" },
                3: { status: "completed", completed_at: "2026-04-03T09:00:00.000Z" },
                4: { status: "completed", completed_at: "2026-04-04T09:00:00.000Z" },
            },
            actionsMap: {
                "diet-1": { type: "DIET" },
            },
            explicitStartDate: "2026-04-01T00:00:00.000Z",
            today: new Date("2026-04-05T12:00:00.000Z"),
        });

        expect(resolved.recommendedDayIndex).toBe(5);
    });

    it("preserves sequence under delayed training completion", () => {
        const sameDay = deriveStrictSequentialProgressDay({
            planDays: buildPlanDays(false),
            startExecutionDay: 1,
            executionsByDayIndex: {
                1: { status: "completed", completed_at: "2026-04-01T09:00:00.000Z" },
                2: { status: "completed", completed_at: "2026-04-02T09:00:00.000Z" },
                3: { status: "completed", completed_at: "2026-04-05T09:00:00.000Z" },
            },
            explicitStartDate: "2026-04-01T00:00:00.000Z",
            today: new Date("2026-04-05T12:00:00.000Z"),
        });
        expect(sameDay.recommendedDayIndex).toBe(4);

        const nextDay = deriveStrictSequentialProgressDay({
            planDays: buildPlanDays(false),
            startExecutionDay: 1,
            executionsByDayIndex: {
                1: { status: "completed", completed_at: "2026-04-01T09:00:00.000Z" },
                2: { status: "completed", completed_at: "2026-04-02T09:00:00.000Z" },
                3: { status: "completed", completed_at: "2026-04-05T09:00:00.000Z" },
            },
            explicitStartDate: "2026-04-01T00:00:00.000Z",
            today: new Date("2026-04-06T12:00:00.000Z"),
        });
        expect(nextDay.recommendedDayIndex).toBe(5);
    });
});

