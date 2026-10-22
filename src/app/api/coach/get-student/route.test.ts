import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const QUERY_LATENCY_MS = 30;
const USER_ID = "coach-user-1";
const COACH_ID = "coach-1";
const STUDENT_ID = "student-1";
const SUBSCRIPTION_ID = "sub-1";

const mocks = vi.hoisted(() => ({
    handlers: {} as Record<string, (ctx: any) => any>,
    started: [] as string[],
    contexts: [] as any[],
    sessionUserId: "coach-user-1" as string | null,
    current1RM: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => {
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        mocks.started.push(ctx.table);
        mocks.contexts.push(ctx);
        await new Promise((resolve) => setTimeout(resolve, QUERY_LATENCY_MS));
        const handler = mocks.handlers[ctx.table];
        return handler ? handler(ctx) : { data: null, error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    getServerSession: async () => (mocks.sessionUserId ? { user: { id: mocks.sessionUserId } } : null),
}));

vi.mock("@/lib/auth", () => ({
    getAuthUser: async () => ({ isAuthenticated: false, userId: null }),
}));

vi.mock("@/app/api/student/get-current-1rm/route", () => ({
    getCurrent1RMRecords: mocks.current1RM,
}));

import { POST } from "./route";

function request(body: unknown) {
    return new Request("http://localhost/api/coach/get-student", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function hasEq(ctx: SupabaseExecContext, column: string, value: unknown) {
    return ctx.filters.some((f) => f.kind === "eq" && f.args[0] === column && f.args[1] === value);
}

function subscriptionRow(overrides: Record<string, unknown> = {}) {
    return {
        id: SUBSCRIPTION_ID,
        coach_id: COACH_ID,
        student_id: STUDENT_ID,
        tier: 1,
        status: "active",
        start_date: "2026-10-01",
        end_date: "2026-10-29",
        updated_at: "2026-10-20T00:00:00Z",
        subscribe_data: { goal: "增肌" },
        monthly_price: 19900,
        subscribed_weeks: 4,
        prior_training_weeks: 0,
        order_id: null,
        last_payment_order_id: null,
        payment_method: "wechat",
        coaches: { user_id: USER_ID },
        ...overrides,
    };
}

beforeEach(() => {
    mocks.started.length = 0;
    mocks.contexts.length = 0;
    mocks.sessionUserId = USER_ID;
    mocks.current1RM.mockReset().mockImplementation(async () => {
        mocks.started.push("current1RM");
        await new Promise((resolve) => setTimeout(resolve, QUERY_LATENCY_MS));
        return [
            { actionId: "a1", actionName: "深蹲", canonicalActionId: "squat", current1RM: 100 },
            { actionId: "a2", actionName: "深蹲", canonicalActionId: null, current1RM: 110 },
        ];
    });
    mocks.handlers = {
        coaches: () => ({ data: { id: COACH_ID }, error: null }),
        coach_subscriptions: () => ({ data: subscriptionRow(), error: null }),
        user_profiles: () => ({ data: { user_id: STUDENT_ID, nickname: "小明", full_name: null }, error: null }),
        users: () => ({ data: { id: STUDENT_ID, phone: "13800000000", email: null, wechat_openid: null }, error: null }),
        training_videos: () => ({
            data: [{ coach_feedback: { text: "不错" } }, { coach_feedback: {} }, { coach_feedback: null }],
            error: null,
        }),
    };
});

function contextFor(table: string) {
    return mocks.contexts.find((ctx) => ctx.table === table) as SupabaseExecContext;
}

describe("POST /api/coach/get-student", () => {
    it("returns the student shape without leaking the coaches join", async () => {
        const res = await POST(request({ studentId: STUDENT_ID }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(Object.keys(body.data)).toEqual(["student"]);
        const { student } = body.data;
        expect(student).not.toHaveProperty("coaches");
        expect(Object.keys(student).sort()).toEqual([
            "coach_id", "end_date", "id", "last_payment_order_id", "monthly_price", "order_id",
            "payment_method", "prior_training_weeks", "profile", "reviewed", "start_date", "status",
            "student_id", "subscribe_data", "subscribed_weeks", "tier", "updated_at", "uploaded",
        ]);
        expect(student).toMatchObject({
            id: SUBSCRIPTION_ID,
            student_id: STUDENT_ID,
            monthly_price: 199,
            uploaded: 3,
            reviewed: 1,
            profile: { nickname: "小明" },
        });
        expect(mocks.current1RM).not.toHaveBeenCalled();
    });

    it("filters the subscription by the logged-in coach, by studentId or subscriptionId", async () => {
        await POST(request({ studentId: STUDENT_ID }));
        const byStudent = contextFor("coach_subscriptions");
        expect(hasEq(byStudent, "coaches.user_id", USER_ID)).toBe(true);
        expect(hasEq(byStudent, "status", "active")).toBe(true);
        expect(hasEq(byStudent, "student_id", STUDENT_ID)).toBe(true);
        expect(byStudent.filters.find((f) => f.kind === "select")?.args[0]).toContain("coaches!inner(user_id)");

        mocks.contexts.length = 0;
        await POST(request({ subscriptionId: SUBSCRIPTION_ID }));
        const bySubscription = contextFor("coach_subscriptions");
        expect(hasEq(bySubscription, "coaches.user_id", USER_ID)).toBe(true);
        expect(hasEq(bySubscription, "id", SUBSCRIPTION_ID)).toBe(true);
    });

    it("returns 404 when the student is not subscribed to this coach", async () => {
        mocks.handlers.coach_subscriptions = () => ({ data: null, error: null });

        const res = await POST(request({ studentId: "someone-else" }));

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ success: false, message: "未找到该学生或订阅已失效", data: null });
        expect(mocks.started).not.toContain("user_profiles");
        expect(mocks.current1RM).not.toHaveBeenCalled();
    });

    it("returns 404 when the subscription row belongs to a different coach", async () => {
        mocks.handlers.coach_subscriptions = () => ({ data: subscriptionRow({ coach_id: "other-coach" }), error: null });

        const res = await POST(request({ subscriptionId: SUBSCRIPTION_ID, need1RM: true }));

        expect(res.status).toBe(404);
        expect(mocks.started).not.toContain("user_profiles");
        expect(mocks.current1RM).not.toHaveBeenCalled();
    });

    it("returns 400 when the user is not a coach", async () => {
        mocks.handlers.coaches = () => ({ data: null, error: null });

        const res = await POST(request({ studentId: STUDENT_ID }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ success: false, message: "未找到教练身份", data: null });
        expect(mocks.started).not.toContain("user_profiles");
    });

    it("returns 500 with the subscription query error", async () => {
        mocks.handlers.coach_subscriptions = () => ({ data: null, error: { message: "db down" } });

        const res = await POST(request({ studentId: STUDENT_ID }));

        expect(res.status).toBe(500);
        expect((await res.json()).message).toBe("db down");
    });

    it("returns 404 for a deactivated student account", async () => {
        mocks.handlers.users = () => ({ data: { id: STUDENT_ID, phone: null, email: null, wechat_openid: null }, error: null });

        const res = await POST(request({ studentId: STUDENT_ID }));

        expect(res.status).toBe(404);
        expect((await res.json()).message).toBe("未找到该学生或账号已注销");
    });

    it("builds aggregated1RM for the student and skips the duplicate permission re-check", async () => {
        const body = await (await POST(request({ studentId: STUDENT_ID, need1RM: true }))).json();

        expect(mocks.current1RM).toHaveBeenCalledWith(
            USER_ID,
            { targetUserId: STUDENT_ID, preferPR: true },
            { authorizationVerified: true },
        );
        expect(body.data.student.aggregated1RM).toEqual({ a1: 100, a2: 110, "深蹲": 110, squat: 100 });
    });

    it("runs in two query rounds: identity + subscription, then everything else", async () => {
        let startedBeforeCoachResolved: string[] = [];
        let startedBeforeProfileResolved: string[] = [];
        const coaches = mocks.handlers.coaches;
        const profiles = mocks.handlers.user_profiles;
        mocks.handlers.coaches = (ctx) => {
            startedBeforeCoachResolved = [...mocks.started];
            return coaches(ctx);
        };
        mocks.handlers.user_profiles = (ctx) => {
            startedBeforeProfileResolved = [...mocks.started];
            return profiles(ctx);
        };

        await POST(request({ studentId: STUDENT_ID, need1RM: true }));

        expect(startedBeforeCoachResolved).toEqual(["coaches", "coach_subscriptions"]);
        expect(startedBeforeProfileResolved).toEqual(
            expect.arrayContaining(["users", "training_videos", "current1RM"]),
        );
    });

    it("rejects missing params and unauthenticated requests", async () => {
        expect((await POST(request({}))).status).toBe(400);

        mocks.sessionUserId = null;
        expect((await POST(request({ studentId: STUDENT_ID }))).status).toBe(401);
    });
});
