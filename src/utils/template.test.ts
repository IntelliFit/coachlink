import { describe, expect, it } from "vitest";

import { checkTrainingDays, validateTrainingDaysPresence } from "./template";

describe("template guards", () => {
    it("rejects empty training days early", () => {
        const result = validateTrainingDaysPresence([]);
        expect(result.valid).toBe(false);
        expect(result.message).toContain("至少需要保留 1 天");
    });

    it("keeps checkTrainingDays aligned with empty-day guard", () => {
        const result = checkTrainingDays([]);
        expect(result.valid).toBe(false);
        expect(result.message).toContain("至少需要保留 1 天");
    });

    it("accepts a minimal non-empty plan", () => {
        const result = checkTrainingDays([
            {
                dayIndex: 1,
                type: "rest",
                note: "",
                actionSets: [],
            },
        ]);
        expect(result.valid).toBe(true);
    });
});
