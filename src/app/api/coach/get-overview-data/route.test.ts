import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const QUERY_LATENCY_MS = 30;
const USER_ID = "user-1";
const COACH_ID = "coach-1";

const mocks = vi.hoisted(() => ({
    handlers: {} as Record<string, (ctx: any) => any>,
    started: [] as string[],
    sessionUserId: "user-1" as string | null,
    revenue: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
    default: createMockSupabase(async (ctx: SupabaseExecContext) => {
        mocks.started.push(ctx.table);
        await new Promise((resolve) => setTimeout(resolve, QUERY_LATENCY_MS));
        const handler = mocks.handlers[ctx.table];
        return handler ? handler(ctx) : { data: [], error: null };
    }),
}));

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    getServerSession: async () => (mocks.sessionUserId ? { user: { id: mocks.sessionUserId } } : null),
}));

vi.mock("@/lib/auth", () => ({
    getAuthUser: async () => ({ isAuthenticated: false, userId: null }),
}));

vi.mock("@/lib/coachRevenueSummary", () => ({
    buildCoachMonthlyRevenueSummary: mocks.revenue,
}));

import { POST } from "./route";

function request() {
    return new Request("http://localhost/api/coach/get-overview-data", {
        method: "POST",
        body: JSON.stringify({}),
    });
}

function hasEq(ctx: SupabaseExecContext, column: string, value: unknown) {
    return ctx.filters.some((f) => f.kind === "eq" && f.args[0] === column && f.args[1] === value);
}

beforeEach(() => {
    mocks.started.length = 0;
    mocks.sessionUserId = USER_ID;
    mocks.revenue.mockReset().mockImplementation(async () => {
        mocks.started.push("revenue");
        await new Promise((resolve) => setTimeout(resolve, QUERY_LATENCY_MS * 3));
        return { subscriptionRevenue: 300, contentPurchaseRevenue: 20, totalRevenue: 320, items: [] };
    });
    mocks.handlers = {
        coaches: () => ({
            data: {
                id: COACH_ID,
                huifu_open_status: "opened",
                huifu_card_token: "token",
                huifu_open_msg: null,
            },
            error: null,
        }),
        coach_subscriptions: () => ({
            data: [{ student_id: "s1" }, { student_id: "s2" }, { student_id: "s3" }, { student_id: "s1" }],
            error: null,
        }),
        student_comments: () => ({ data: [{ rating: 5 }, { rating: 4 }, { rating: 4 }], error: null }),
        coach_contents: () => ({ data: null, error: null, count: 7 }),
        coach_plan_templates: () => ({ data: null, error: null, count: 3 }),
        coach_actions: () => ({ data: null, error: null, count: 12 }),
        coach_questionnaires: () => ({ data: [{ id: "q1", status: "draft" }, { id: "q2", status: "active" }], error: null }),
        coach_pricing: () => ({ data: { id: "p1" }, error: null }),
        execution_set_videos: () => ({ data: null, error: null, count: 4 }),
        // s3 已注销（无联系方式），s2 没有可见昵称
        users: () => ({ data: [{ id: "s1" }, { id: "s2" }], error: null }),
        user_profiles: () => ({
            data: [
                { user_id: "s1", nickname: "小明", full_name: null },
                { user_id: "s2", nickname: null, full_name: null },
                { user_id: "s3", nickname: "已注销", full_name: null },
            ],
            error: null,
        }),
    };
});

describe("POST /api/coach/get-overview-data", () => {
    it("returns the same overview shape and values", async () => {
        const res = await POST(request());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({
            success: true,
            data: {
                totalStudentCount: 1,
                pendingReviewCount: 4,
                averageRating: 4.3,
                monthlyRevenue: 320,
                contentCount: 7,
                actionCount: 12,
                planTemplateCount: 3,
                questionReady: true,
                pricingReady: true,
                receivingAccountReady: true,
                huifuOpenStatus: "opened",
                huifuOpenMsg: null,
            },
        });
        expect(mocks.revenue).toHaveBeenCalledWith(expect.objectContaining({ coachId: COACH_ID }));
    });

    it("scopes every stat to the logged-in coach", async () => {
        const contexts: SupabaseExecContext[] = [];
        const original = { ...mocks.handlers };
        for (const table of Object.keys(original)) {
            mocks.handlers[table] = (ctx) => {
                contexts.push(ctx);
                return original[table](ctx);
            };
        }

        await POST(request());

        const byTable = (table: string) => contexts.find((ctx) => ctx.table === table)!;
        expect(hasEq(byTable("coaches"), "user_id", USER_ID)).toBe(true);
        for (const table of ["coach_subscriptions", "student_comments", "coach_contents", "coach_pricing"]) {
            expect(hasEq(byTable(table), "coach_id", COACH_ID)).toBe(true);
        }
        for (const table of ["coach_plan_templates", "coach_actions", "coach_questionnaires"]) {
            expect(hasEq(byTable(table), "coach_id", USER_ID)).toBe(true);
        }
        const videoFilter = byTable("execution_set_videos").filters.find((f) => f.kind === "in");
        expect(videoFilter?.args).toEqual(["plan_instance_executions.student_id", ["s1", "s2", "s3"]]);
    });

    it("starts revenue with the stats batch and runs the student-id follow-ups together", async () => {
        let startedBeforeSubscriptionsResolved: string[] = [];
        let startedBeforeVideosResolved: string[] = [];
        const subscriptions = mocks.handlers.coach_subscriptions;
        const videos = mocks.handlers.execution_set_videos;
        mocks.handlers.coach_subscriptions = (ctx) => {
            startedBeforeSubscriptionsResolved = [...mocks.started];
            return subscriptions(ctx);
        };
        mocks.handlers.execution_set_videos = (ctx) => {
            startedBeforeVideosResolved = [...mocks.started];
            return videos(ctx);
        };

        await POST(request());

        expect(startedBeforeSubscriptionsResolved).toEqual(expect.arrayContaining(["revenue", "coach_pricing"]));
        expect(startedBeforeSubscriptionsResolved).not.toContain("execution_set_videos");
        expect(startedBeforeVideosResolved).toEqual(expect.arrayContaining(["users", "user_profiles"]));
    });

    it("skips the student-id follow-ups when the coach has no active students", async () => {
        mocks.handlers.coach_subscriptions = () => ({ data: [], error: null });

        const body = await (await POST(request())).json();

        expect(body.data).toMatchObject({ totalStudentCount: 0, pendingReviewCount: 0 });
        expect(mocks.started).not.toContain("execution_set_videos");
        expect(mocks.started).not.toContain("users");
    });

    it("falls back to zero revenue when the revenue summary fails", async () => {
        mocks.revenue.mockRejectedValue(new Error("boom"));
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const body = await (await POST(request())).json();

        expect(body.success).toBe(true);
        expect(body.data.monthlyRevenue).toBe(0);
        consoleError.mockRestore();
    });

    it("rejects an unauthenticated request", async () => {
        mocks.sessionUserId = null;

        const res = await POST(request());

        expect(res.status).toBe(401);
        expect(mocks.started).toEqual([]);
    });

    it("returns 404 without running stats when the user is not a coach", async () => {
        mocks.handlers.coaches = () => ({ data: null, error: { message: "not found" } });

        const res = await POST(request());

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ success: false, message: "教练不存在" });
        expect(mocks.started).toEqual(["coaches"]);
        expect(mocks.revenue).not.toHaveBeenCalled();
    });
});
