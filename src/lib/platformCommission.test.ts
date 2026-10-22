import { describe, expect, it } from "vitest";
import {
    LEGACY_DIRECT_PAY_COMMISSION_PERCENT,
    PLATFORM_COMMISSION_PERCENT,
    resolveCoachSettlementDelayDays,
    resolveSettlementCoachAmountFen,
    splitOrderAmountFen,
} from "./platformCommission";

describe("splitOrderAmountFen", () => {
    it("charges the 10% early-stage platform fee by default", () => {
        expect(PLATFORM_COMMISSION_PERCENT).toBe(10);
        expect(splitOrderAmountFen(29900)).toEqual({ coachAmount: 26910, platformFee: 2990 });
    });

    it("rounds the platform fee down so the remainder goes to the coach", () => {
        expect(splitOrderAmountFen(999)).toEqual({ coachAmount: 900, platformFee: 99 });
        expect(splitOrderAmountFen(9)).toEqual({ coachAmount: 9, platformFee: 0 });
    });

    it("keeps the legacy 20% rule available for old direct-pay orders", () => {
        expect(splitOrderAmountFen(10000, LEGACY_DIRECT_PAY_COMMISSION_PERCENT)).toEqual({
            coachAmount: 8000,
            platformFee: 2000,
        });
    });

    it("treats negative or fractional totals safely", () => {
        expect(splitOrderAmountFen(-100)).toEqual({ coachAmount: 0, platformFee: 0 });
        expect(splitOrderAmountFen(1000.4)).toEqual({ coachAmount: 900, platformFee: 100 });
    });
});

describe("resolveCoachSettlementDelayDays", () => {
    it("defaults to 7 days and accepts configured values", () => {
        expect(resolveCoachSettlementDelayDays(undefined)).toBe(7);
        expect(resolveCoachSettlementDelayDays("3")).toBe(3);
    });

    it("ignores invalid or negative values", () => {
        expect(resolveCoachSettlementDelayDays("abc")).toBe(7);
        expect(resolveCoachSettlementDelayDays("-2")).toBe(0);
    });
});

describe("resolveSettlementCoachAmountFen", () => {
    it("pays the coach amount recorded when the order was paid", () => {
        // 下单时按 20% 记录的结算单，上线 10% 之后再分账也必须按记录金额转
        expect(resolveSettlementCoachAmountFen({ coach_amount: 8000 }, 10000)).toBe(8000);
        expect(resolveSettlementCoachAmountFen({ coach_amount: "8000" }, 10000)).toBe(8000);
    });

    it("falls back to the current rate only when nothing usable was recorded", () => {
        expect(resolveSettlementCoachAmountFen({ coach_amount: null }, 10000)).toBe(9000);
        expect(resolveSettlementCoachAmountFen({ coach_amount: 0 }, 10000)).toBe(9000);
        expect(resolveSettlementCoachAmountFen(undefined, 10000)).toBe(9000);
    });
});
