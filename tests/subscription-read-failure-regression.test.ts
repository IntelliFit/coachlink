import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ results: [] as any[], writes: [] as any[] }));
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    // The expiry trigger is admin-only; the other helpers here do not read the session.
    getServerSession: async () => ({ user: { id: "student", is_admin: true } }),
}));
vi.mock("@/lib/supabaseClient", () => ({
    default: {
        from() {
            const query: any = {
                select: () => query, eq: () => query, in: () => query, order: () => query,
                not: () => query, gt: () => query,
                update: (patch: any) => { database.writes.push(patch); return query; },
                maybeSingle: async () => database.results.shift(),
                single: async () => database.results.shift(),
                then: (resolve: any, reject: any) => Promise.resolve(database.results.shift()).then(resolve, reject),
            };
            return query;
        },
    },
}));

import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import { refreshSubscriptionEntitlementSnapshot } from "@/lib/subscriptionEntitlementSnapshot";
import { validateExecutionSubscriptionAccess } from "@/app/api/execution/_helpers/subscriptionAccess";
import { updateEstimatedEndDateForInstance } from "@/app/api/execution/updateEstimatedEndDate";
import { POST as checkExpired } from "@/app/api/subscription/check-expired-subscriptions/route";

const failure = { data: null, error: { message: "database unavailable" } };
const ok = (data: any) => ({ data, error: null });
const instance = {
    id: "plan", coach_subscription_id: "sub", student_id: "student", status: "active",
    start_execution_day: 1, created_at: "2026-09-01T00:00:00Z",
    training_days: [{ dayIndex: 1, type: "training" }],
};
const subscription = { id: "sub", status: "active", subscribed_weeks: 4, student_id: "student" };

describe("unknown subscription data must not become unused entitlement", () => {
    beforeEach(() => { database.results = []; database.writes = []; });

    it.each(["plans", "executions"])("does not grant full carryover when %s cannot be loaded", async (stage) => {
        database.results = stage === "plans" ? [failure] : [ok([instance]), failure];
        await expect(getSubscriptionCarryoverSummary({ subscriptionId: "sub", subscribedWeeks: 4 })).rejects.toThrow("database unavailable");
        expect(database.writes).toEqual([]);
    });

    it("still distinguishes a successful empty history from failure", async () => {
        database.results = [ok([])];
        expect((await getSubscriptionCarryoverSummary({ subscriptionId: "sub", subscribedWeeks: 4 })).remainingWeeks).toBe(4);
    });

    it.each([0, 1, 2])("does not persist a derived end date after read %i fails", async (index) => {
        database.results = [ok(subscription), ok([instance]), ok([])].slice(0, index).concat(failure);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            // A renewal may already be committed; a failed projection must not
            // tell the caller to retry granting the purchase.
            expect(await refreshSubscriptionEntitlementSnapshot("sub")).toBeNull();
            expect(database.writes).toEqual([]);
            expect(log).toHaveBeenCalled();
        } finally { log.mockRestore(); }
    });

    it.each([0, 1, 2])("denies training as temporarily unknown, not expired, after read %i fails", async (index) => {
        database.results = [ok(instance), ok(subscription), ok([])].slice(0, index).concat(failure);
        const decision = await validateExecutionSubscriptionAccess({ instanceId: "plan", studentId: "student", dayIndex: 1 });
        expect(decision.allowed).toBe(false);
        expect(decision.status).toBe(503);
        expect(database.writes).toEqual([]);
    });

    it("leaves the estimated end date untouched when completed executions fail to load", async () => {
        database.results = [ok(instance), ok(subscription), ok([]), failure];
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            await updateEstimatedEndDateForInstance("plan");
            expect(database.writes).toEqual([]);
            expect(log).toHaveBeenCalled();
        } finally { log.mockRestore(); }
    });

    it.each(["plans", "executions"])("does not expire any subscriptions when the %s scan fails", async (stage) => {
        database.results = stage === "plans"
            ? [ok([subscription]), failure]
            : [ok([subscription]), ok([instance]), failure];
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const response = await checkExpired(new Request("http://localhost/api/subscription/check-expired-subscriptions", { method: "POST" }));
            expect(response.status).toBe(503);
            expect((await response.json()).success).toBe(false);
            expect(database.writes).toEqual([]);
        } finally { log.mockRestore(); }
    });
});
