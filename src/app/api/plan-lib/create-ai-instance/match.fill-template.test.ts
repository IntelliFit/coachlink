import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ default: {} }));
vi.mock("@/app/api/student/get-current-1rm/route", () => ({ getCurrent1RMRecords: async () => [] }));

import { fillTemplate } from "./match";

const filterDay = () => ({
    type: "training",
    dayIndex: 1,
    actionSets: [
        {
            type: "one-filter",
            question: { question: "可用器械", type: "option", options: ["杠铃", "哑铃"] },
            actions: [
                { type: "no-filter", actionId: "act-barbell", params: {} },
                { type: "no-filter", actionId: "act-dumbbell", params: {} },
            ],
        },
        { type: "no-filter", actionId: "act-plank", params: {} },
    ],
});

const actionIds = (template: any) => template.training_days[0].actionSets.map((set: any) => set.actionId);

describe("fillTemplate one-filter actions", () => {
    it("uses the student's answer when there is one", async () => {
        const template: any = { training_days: [filterDay()] };
        await fillTemplate([{ type: "option", question: "可用器械", userSelection: 1 } as any], template);
        expect(actionIds(template)).toEqual(["act-dumbbell", "act-plank"]);
    });

    it("falls back to the first option when the questionnaire lacks the question", async () => {
        // Closest-template fallback and coaches without a questionnaire both hit this.
        const template: any = { training_days: [filterDay()] };
        await fillTemplate([], template, { studentBodyWeight: null, autoComputeActions: [] });
        expect(actionIds(template)).toEqual(["act-barbell", "act-plank"]);
    });

    it("falls back to the first option when the stored answer is out of range", async () => {
        const template: any = { training_days: [filterDay()] };
        await fillTemplate([{ type: "option", question: "可用器械", userSelection: 5 } as any], template);
        expect(actionIds(template)).toEqual(["act-barbell", "act-plank"]);
    });
});
