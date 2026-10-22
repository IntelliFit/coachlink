import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({ default: {} }));

import {
    applySubscriptionSort,
    normalizeStudentSearch,
    orderRowsByIds,
    pageMatchedSubscriptionIds,
} from "./studentSearch";

describe("normalizeStudentSearch", () => {
    it("trims, strips PostgREST-sensitive separators and caps length", () => {
        expect(normalizeStudentSearch("  张,三\n")).toBe("张 三");
        expect(normalizeStudentSearch(undefined)).toBe("");
        expect(normalizeStudentSearch("x".repeat(100))).toHaveLength(64);
    });
});

describe("applySubscriptionSort", () => {
    function recorder() {
        const calls: unknown[][] = [];
        const query = { order: (...args: unknown[]) => { calls.push(args); return query; } };
        return { query, calls };
    }

    it.each([
        ["subscription_created_desc", [["created_at", { ascending: false, nullsFirst: false }], ["id", { ascending: false }]]],
        ["subscription_created_asc", [["created_at", { ascending: true, nullsFirst: false }], ["id", { ascending: true }]]],
        ["subscription_updated_desc", [["updated_at", { ascending: false, nullsFirst: false }], ["id", { ascending: false }]]],
    ] as const)("%s keeps the list ordering", (mode, expected) => {
        const { query, calls } = recorder();
        applySubscriptionSort(query, mode);
        expect(calls).toEqual(expected);
    });
});

describe("pageMatchedSubscriptionIds", () => {
    const refs = Array.from({ length: 5 }, (_, i) => ({ id: `sub-${i}`, student_id: `s${i}` }));

    it("filters to matched students before paging and keeps the order", () => {
        expect(pageMatchedSubscriptionIds(refs, new Set(["s4", "s1", "s3"]), 1, 1))
            .toEqual({ total: 3, pageIds: ["sub-3"] });
    });

    it("returns the real total and no ids past the last page", () => {
        expect(pageMatchedSubscriptionIds(refs, new Set(["s0", "s1"]), 20, 10)).toEqual({ total: 2, pageIds: [] });
    });

    it("keeps every subscription of a student with several active ones", () => {
        const dup = [...refs, { id: "sub-1b", student_id: "s1" }];
        expect(pageMatchedSubscriptionIds(dup, new Set(["s1"]), 0, 10)).toEqual({ total: 2, pageIds: ["sub-1", "sub-1b"] });
    });
});

describe("orderRowsByIds", () => {
    it("restores the requested order and drops missing rows", () => {
        expect(orderRowsByIds([{ id: "b" }, { id: "a" }], ["a", "x", "b"])).toEqual([{ id: "a" }, { id: "b" }]);
    });
});
