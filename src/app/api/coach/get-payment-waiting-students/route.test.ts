import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const QUERY_LATENCY_MS = 30;
const USER_ID = "coach-user-1";
const COACH_ID = "coach-1";

const mocks = vi.hoisted(() => ({
    handlers: {} as Record<string, (ctx: any) => any>,
    started: [] as string[],
    contexts: [] as any[],
    sessionUserId: "coach-user-1" as string | null,
}));

vi.mock("@/lib/supabaseClient", () => {
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        mocks.started.push(ctx.table);
        mocks.contexts.push(ctx);
        await new Promise((resolve) => setTimeout(resolve, QUERY_LATENCY_MS));
        const handler = mocks.handlers[ctx.table];
        return handler ? handler(ctx) : { data: [], error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    getServerSession: async () => (mocks.sessionUserId ? { user: { id: mocks.sessionUserId } } : null),
}));

import { POST } from "./route";

function request() {
    return new Request("http://localhost/api/coach/get-payment-waiting-students", {
        method: "POST",
        body: JSON.stringify({}),
    });
}

function hasEq(ctx: SupabaseExecContext, column: string, value: unknown) {
    return ctx.filters.some((f) => f.kind === "eq" && f.args[0] === column && f.args[1] === value);
}

function order(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        subscription_id: `sub-of-${id}`,
        student_id: "student-1",
        coach_id: COACH_ID,
        tier: 1,
        amount_fen: 19900,
        purchased_weeks: 4,
        status: "pending_confirmation",
        payment_method: "manual",
        payment_confirmed_by: null,
        payment_confirmed_at: null,
        coach_seen_at: null,
        payment_data: null,
        note: null,
        alipay_order_id: null,
        product_id: null,
        product_name: null,
        product_tier: null,
        order_type: "subscription",
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
        ...overrides,
    };
}

function legacySubscription(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        student_id: "student-2",
        coach_id: COACH_ID,
        tier: 1,
        monthly_price: 9900,
        subscribed_weeks: 4,
        status: "waiting",
        payment_method: "manual",
        payment_confirmed_by: null,
        payment_confirmed_at: null,
        coach_seen_at: null,
        payment_data: null,
        remind_coach_note: null,
        order_id: null,
        product_id: null,
        product_name: null,
        product_tier: null,
        created_at: "2026-10-02T00:00:00Z",
        updated_at: "2026-10-02T00:00:00Z",
        ...overrides,
    };
}

beforeEach(() => {
    mocks.started.length = 0;
    mocks.contexts.length = 0;
    mocks.sessionUserId = USER_ID;
    mocks.handlers = {
        coaches: () => ({ data: { id: COACH_ID }, error: null }),
        coach_subscription_orders: (ctx) => hasEq(ctx, "status", "pending_confirmation")
            ? { data: [order("order-manual")], error: null }
            : {
                data: [order("order-system", {
                    status: "paid",
                    payment_confirmed_by: "system",
                    payment_confirmed_at: "2026-10-03T00:00:00Z",
                })],
                error: null,
            },
        coach_subscriptions: (ctx) => hasEq(ctx, "status", "waiting")
            ? { data: [legacySubscription("legacy-manual")], error: null }
            : {
                data: [legacySubscription("legacy-system", {
                    status: "active",
                    payment_confirmed_by: "system",
                    payment_confirmed_at: "2026-10-05T00:00:00Z",
                })],
                error: null,
            },
    };
});

describe("POST /api/coach/get-payment-waiting-students", () => {
    it("merges orders and legacy subscriptions into the same response shape", async () => {
        const res = await POST(request());
        const body = await res.json();

        expect(body.success).toBe(true);
        expect(body.message).toBe("获取待支付确认列表成功");
        expect(Object.keys(body.data).sort()).toEqual(["manualSubscriptions", "systemSubscriptions"]);
        expect(body.data.manualSubscriptions.map((row: any) => [row.id, row.record_kind])).toEqual([
            ["legacy-manual", "legacy_subscription"],
            ["order-manual", "subscription_order"],
        ]);
        expect(body.data.systemSubscriptions.map((row: any) => [row.id, row.record_kind])).toEqual([
            ["legacy-system", "legacy_subscription"],
            ["order-system", "subscription_order"],
        ]);
    });

    it("selects only the coach id and scopes every list to that coach", async () => {
        await POST(request());

        const coachCtx = mocks.contexts.find((ctx) => ctx.table === "coaches") as SupabaseExecContext;
        expect(coachCtx.filters.find((f) => f.kind === "select")?.args[0]).toBe("id");
        expect(hasEq(coachCtx, "user_id", USER_ID)).toBe(true);

        const listContexts = mocks.contexts.filter((ctx) => ctx.table !== "coaches") as SupabaseExecContext[];
        expect(listContexts).toHaveLength(4);
        for (const ctx of listContexts) {
            expect(hasEq(ctx, "coach_id", COACH_ID)).toBe(true);
        }
    });

    it("starts all four lists together once the coach is known", async () => {
        let startedBeforeFirstListResolved: string[] = [];
        const orders = mocks.handlers.coach_subscription_orders;
        mocks.handlers.coach_subscription_orders = (ctx) => {
            if (startedBeforeFirstListResolved.length === 0) {
                startedBeforeFirstListResolved = [...mocks.started];
            }
            return orders(ctx);
        };

        await POST(request());

        expect(startedBeforeFirstListResolved).toEqual([
            "coaches",
            "coach_subscription_orders",
            "coach_subscription_orders",
            "coach_subscriptions",
            "coach_subscriptions",
        ]);
    });

    it("tolerates a missing orders table and still returns legacy rows", async () => {
        mocks.handlers.coach_subscription_orders = () => ({
            data: null,
            error: { message: 'relation "coach_subscription_orders" does not exist' },
        });

        const body = await (await POST(request())).json();

        expect(body.success).toBe(true);
        expect(body.data.manualSubscriptions.map((row: any) => row.id)).toEqual(["legacy-manual"]);
        expect(body.data.systemSubscriptions.map((row: any) => row.id)).toEqual(["legacy-system"]);
    });

    it("reports the first failing list in the original check order", async () => {
        mocks.handlers.coach_subscriptions = (ctx) => hasEq(ctx, "status", "waiting")
            ? { data: null, error: { message: "waiting failed" } }
            : { data: null, error: { message: "system failed" } };

        const body = await (await POST(request())).json();

        expect(body).toEqual({ success: false, message: "waiting failed" });
    });

    it("returns the coach lookup error without querying the lists", async () => {
        mocks.handlers.coaches = () => ({ data: null, error: { message: "no coach" } });

        const body = await (await POST(request())).json();

        expect(body).toEqual({ success: false, message: "no coach" });
        expect(mocks.started).toEqual(["coaches"]);
    });

    it("rejects an unauthenticated request", async () => {
        mocks.sessionUserId = null;

        const res = await POST(request());

        expect(res.status).toBe(401);
        expect(mocks.started).toEqual([]);
    });
});
