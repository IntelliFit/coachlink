import { describe, expect, it, vi } from "vitest";
import {
    enrichCoachFromApplication,
    mergeProfile,
    parseCachedReviewStats,
    settleWithin,
    summarizeRatings,
} from "./coachAggregatedInfo";

describe("mergeProfile", () => {
    it("fills only keys the coach profile has never set", () => {
        const merged = mergeProfile(
            { bio: null, credentials: [], teachingPhilosophy: "自己写的" },
            { bio: "申请里的", credentials: ["CSCS"], teachingPhilosophy: "申请里的", caseStudies: "案例" },
        );
        expect(merged).toEqual({
            bio: null,
            credentials: [],
            teachingPhilosophy: "自己写的",
            caseStudies: "案例",
        });
    });

    it("skips null/undefined incoming values and does not mutate the base", () => {
        const base = { a: 1 };
        const merged = mergeProfile(base, { b: null, c: undefined, d: 2 });
        expect(merged).toEqual({ a: 1, d: 2 });
        expect(base).toEqual({ a: 1 });
    });
});

describe("enrichCoachFromApplication", () => {
    const coach = {
        id: "c1",
        user_id: "u1",
        name: "",
        title: null,
        avatar_url: null,
        service_modes: [],
        target_student_levels: ["beginner"],
        profile: { contactEmail: "own@example.com" },
    };

    it("returns the coach unchanged when there is no application", () => {
        expect(enrichCoachFromApplication(coach, null)).toBe(coach);
    });

    it("falls back to application fields only where the coach is empty", () => {
        const enriched = enrichCoachFromApplication(coach, {
            name: "申请名",
            title: "申请头衔",
            avatar_url: "https://img/app.png",
            service_modes: ["online"],
            target_student_levels: ["advanced"],
            contact_email: "app@example.com",
            teaching_philosophy: "循序渐进",
        });
        expect(enriched).toMatchObject({
            id: "c1",
            name: "申请名",
            title: "申请头衔",
            avatar_url: "https://img/app.png",
            service_modes: ["online"],
            target_student_levels: ["beginner"],
            profile: { contactEmail: "own@example.com", teachingPhilosophy: "循序渐进" },
        });
        expect(coach.name).toBe("");
    });
});

describe("summarizeRatings", () => {
    it("returns zeros for no reviews", () => {
        expect(summarizeRatings([])).toEqual({ reviewCount: 0, averageRating: 0 });
        expect(summarizeRatings(null)).toEqual({ reviewCount: 0, averageRating: 0 });
    });

    it("averages to one decimal and treats a null rating as 0", () => {
        expect(summarizeRatings([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toEqual({
            reviewCount: 3,
            averageRating: 4.3,
        });
        expect(summarizeRatings([{ rating: 5 }, { rating: null }])).toEqual({
            reviewCount: 2,
            averageRating: 2.5,
        });
    });
});

describe("parseCachedReviewStats", () => {
    it("accepts a well-formed cached value", () => {
        expect(parseCachedReviewStats('{"reviewCount":2,"averageRating":4.5}')).toEqual({
            reviewCount: 2,
            averageRating: 4.5,
        });
    });

    it.each([null, "", "not json", '{"reviewCount":"2"}', "{}", 42])(
        "treats %j as a cache miss",
        (raw) => {
            expect(parseCachedReviewStats(raw)).toBeNull();
        },
    );
});

describe("settleWithin", () => {
    it("resolves with the value when the promise settles in time", async () => {
        await expect(settleWithin(Promise.resolve("hit"), 50, null)).resolves.toBe("hit");
    });

    it("resolves with the fallback when the promise hangs", async () => {
        vi.useFakeTimers();
        try {
            const pending = settleWithin(new Promise<string>(() => undefined), 200, null);
            await vi.advanceTimersByTimeAsync(200);
            await expect(pending).resolves.toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it("passes a rejection through", async () => {
        await expect(settleWithin(Promise.reject(new Error("boom")), 50, null)).rejects.toThrow("boom");
    });
});
