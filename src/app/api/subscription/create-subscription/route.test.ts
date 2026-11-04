import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const mocks = vi.hoisted(() => ({
    contexts: [] as SupabaseExecContext[],
    existing: null as Record<string, unknown> | null,
    autoMatch: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => {
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        mocks.contexts.push(ctx);
        if (ctx.table === "coaches") return { data: { id: "coach-1", user_id: "coach-user-1" }, error: null };
        if (ctx.table === "coach_subscriptions") {
            if (ctx.op === "insert") return { data: { id: "sub-new", ...ctx.payload }, error: null };
            if (ctx.op === "update") return { data: { ...mocks.existing, ...ctx.payload }, error: null };
            return { data: mocks.existing, error: null };
        }
        return { data: null, error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("@/lib/getApiUserId", () => ({ getApiUserId: async () => "student-1" }));
vi.mock("@/lib/wechatFreeRelease", () => ({ rejectWechatCoachPurchase: () => null, isWechatFreeRequest: async () => false }));
vi.mock("@/app/api/plan-lib/auto-match-plan/service", () => ({ autoMatchPlanForSubscription: mocks.autoMatch }));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
    return new Request("http://localhost/api/subscription/create-subscription", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

const body = { coachId: "coach-1", tier: 1, monthlyPrice: 299, subscribeData: [{ type: "text", question: "目标" }] };
const writes = (op: "insert" | "update") =>
    mocks.contexts.filter((ctx) => ctx.table === "coach_subscriptions" && ctx.op === op);

beforeEach(() => {
    mocks.contexts.length = 0;
    mocks.existing = null;
    mocks.autoMatch.mockReset();
});

describe("POST /api/subscription/create-subscription", () => {
    it("creates a pending subscription even when the client asks for active, and starts no plan", async () => {
        const res = await POST(request({ ...body, status: "active" }));

        expect(res.status).toBe(200);
        expect(writes("insert")[0].payload.status).toBe("inactive");
        expect(mocks.autoMatch).not.toHaveBeenCalled();
    });

    it("defaults to pending when no status is sent", async () => {
        await POST(request(body));
        expect(writes("insert")[0].payload.status).toBe("inactive");
    });

    it("cannot reactivate an existing unpaid subscription", async () => {
        mocks.existing = { id: "sub-old", status: "cancelled" };
        await POST(request({ ...body, status: "active" }));
        expect(writes("update")[0].payload.status).toBe("inactive");
    });
});
