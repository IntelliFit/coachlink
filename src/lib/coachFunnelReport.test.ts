import { describe, expect, it } from "vitest";
import { buildCoachFunnelReport, type FunnelEventRecord } from "./coachFunnelReport";

const COACH_A = "11111111-1111-4111-8111-111111111111";
const COACH_B = "22222222-2222-4222-8222-222222222222";

function event(overrides: Partial<FunnelEventRecord>): FunnelEventRecord {
    return {
        event: "profile_view",
        coach_id: COACH_A,
        user_id: null,
        anon_id: "anon-1",
        reason: null,
        note: null,
        properties: {},
        created_at: "2026-11-02T00:00:00.000Z",
        ...overrides,
    };
}

const coaches = [
    { id: COACH_A, user_id: "coach-user-a", name: "能买教练", huifu_card_token: "token" },
    { id: COACH_B, user_id: "coach-user-b", name: "买不了教练" },
];
const pricing = [{ coach_id: COACH_A, products: [{ id: "p1" }] }];

function report(events: FunnelEventRecord[], paidOrdersByCoach: Record<string, number> = {}) {
    return buildCoachFunnelReport({ events, coaches, pricing, paidOrdersByCoach });
}

describe("buildCoachFunnelReport", () => {
    it("counts each visitor once per step", () => {
        const result = report([
            event({ event: "list_view", coach_id: null }),
            event({ event: "list_view", coach_id: null }),
            event({}),
            event({}),
            event({ anon_id: "anon-2" }),
            event({ event: "pricing_view" }),
            event({ event: "buy_click" }),
        ]);
        expect(result.totals).toMatchObject({ listVisitors: 1, profileVisitors: 2, pricingVisitors: 1, buyClickVisitors: 1 });
    });

    it("separates logged-in users from anonymous visitors", () => {
        const result = report([event({ user_id: "student-1", anon_id: "anon-1" }), event({ user_id: null, anon_id: "anon-1" })]);
        expect(result.totals.profileVisitors).toBe(2);
    });

    it("ignores coaches viewing their own page", () => {
        const result = report([event({ user_id: "coach-user-a", anon_id: null })]);
        expect(result.totals.profileVisitors).toBe(0);
        expect(result.coaches).toEqual([]);
    });

    it("reports per coach whether they can sell and where clicks were blocked", () => {
        const result = report([
            event({ coach_id: COACH_A }),
            event({ coach_id: COACH_B, anon_id: "anon-2" }),
            event({ coach_id: COACH_B, anon_id: "anon-2", event: "buy_click", properties: { blocked: "account_not_ready" } }),
        ]);
        const byName = Object.fromEntries(result.coaches.map((row) => [row.name, row]));
        expect(byName["能买教练"].canSell).toBe(true);
        expect(byName["买不了教练"].canSell).toBe(false);
        expect(byName["买不了教练"].blockedClicks).toBe(1);
        expect(result.totals.blockedVisitors).toBe(1);
    });

    it("needs both an account and a package to sell", () => {
        const noPackage = buildCoachFunnelReport({
            events: [event({})],
            coaches,
            pricing: [],
            paidOrdersByCoach: {},
        });
        expect(noPackage.coaches[0].canSell).toBe(false);
    });

    it("ranks reasons and keeps written notes", () => {
        const result = report([
            event({ event: "exit_reason", reason: "price" }),
            event({ event: "exit_reason", reason: "price", anon_id: "anon-2" }),
            event({ event: "exit_reason", reason: "other", anon_id: "anon-3", note: "想要线下课" }),
            event({ event: "exit_skip", anon_id: "anon-4" }),
        ]);
        expect(result.reasons[0]).toEqual({ reason: "price", label: "价格不合适", count: 2 });
        expect(result.notes).toEqual([
            { coachName: "能买教练", reason: "其他", note: "想要线下课", createdAt: "2026-11-02T00:00:00.000Z" },
        ]);
        expect(result.totals).toMatchObject({ answers: 3, skips: 1 });
    });

    it("includes paid orders for coaches with no tracked events and sorts by views", () => {
        const result = report([event({ coach_id: COACH_B })], { [COACH_A]: 3 });
        expect(result.coaches.map((row) => row.name)).toEqual(["买不了教练", "能买教练"]);
        expect(result.coaches[1].paidOrders).toBe(3);
        expect(result.totals.paidOrders).toBe(3);
    });

    it("leaves trial and dev-site test events out of the report", () => {
        const result = report([
            event({ properties: { env: "trial" } }),
            event({ anon_id: "anon-2", properties: { env: "develop" } }),
            event({ anon_id: "anon-3", properties: { env: "release" } }),
        ]);
        expect(result.totals.profileVisitors).toBe(1);
    });

    it("drops events for unknown coaches and events with no visitor", () => {
        const result = report([
            event({ coach_id: "33333333-3333-4333-8333-333333333333" }),
            event({ user_id: null, anon_id: null }),
        ]);
        expect(result.totals.profileVisitors).toBe(0);
    });
});
