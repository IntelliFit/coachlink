import { describe, expect, it } from "vitest";
import {
    buildProfileOneRmInputs,
    findCardLiftForAction,
    resolveProfileBodyWeight,
} from "./profileOneRm";

const cards = {
    activeCards: ["powerlifting", "streetlifting"],
    powerlifting: { squat: 140, bench: 100, deadlift: null },
    streetlifting: { weightedPullup: 40, weightedDip: 60, weightedMuscleUp: null, squat: 150 },
    bodybuilding: { weight: 78 },
};

describe("profileOneRm", () => {
    it("matches main lifts by exact name and takes the larger value when two cards overlap", () => {
        expect(findCardLiftForAction(cards, "杠铃深蹲")).toEqual({ label: "深蹲", oneRm: 150 });
        expect(findCardLiftForAction(cards, " 卧推 ")).toEqual({ label: "卧推", oneRm: 100 });
        expect(findCardLiftForAction(cards, "负重引体向上")).toEqual({ label: "负重引体", oneRm: 40 });
    });

    it("does not apply the main-lift 1RM to variants or empty fields", () => {
        expect(findCardLiftForAction(cards, "负重引体（底部暂停）")).toBeNull();
        expect(findCardLiftForAction(cards, "暂停深蹲")).toBeNull();
        expect(findCardLiftForAction(cards, "硬拉")).toBeNull();
        expect(findCardLiftForAction(null, "卧推")).toBeNull();
    });

    it("keys the inputs by action id, name and canonical id", () => {
        const inputs = buildProfileOneRmInputs(cards, [
            { id: "a1", name: "卧推", canonical_action_id: "c-bench" },
            { id: "a2", name: "负重臂屈伸", canonical_action_id: null },
            { id: "a3", name: "哑铃弯举", canonical_action_id: "c-curl" },
        ]);
        expect(inputs).toEqual({
            a1: 100,
            卧推: 100,
            "c-bench": 100,
            a2: 60,
            负重臂屈伸: 60,
        });
    });

    it("prefers the profile weight and falls back to the bodybuilding card", () => {
        expect(resolveProfileBodyWeight({ weight: 72, sport_cards: cards })).toBe(72);
        expect(resolveProfileBodyWeight({ weight: null, sport_cards: cards })).toBe(78);
        expect(resolveProfileBodyWeight({ weight: 5, sport_cards: {} })).toBeNull();
        expect(resolveProfileBodyWeight(null)).toBeNull();
    });
});
