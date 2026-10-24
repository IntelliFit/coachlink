import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const QUERY_LATENCY_MS = 30;

const mocks = vi.hoisted(() => ({
    handlers: {} as Record<string, (ctx: SupabaseExecContext) => any>,
    started: [] as string[],
    calls: [] as SupabaseExecContext[],
}));

vi.mock("@/lib/supabaseClient", () => ({
    default: createMockSupabase(async (ctx: SupabaseExecContext) => {
        mocks.started.push(ctx.table);
        mocks.calls.push(ctx);
        await new Promise((resolve) => setTimeout(resolve, QUERY_LATENCY_MS));
        const handler = mocks.handlers[ctx.table];
        return handler ? handler(ctx) : { data: [], error: null };
    }),
}));

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    getServerSession: async () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/auth", () => ({
    getAuthUser: async () => ({ isAuthenticated: false, userId: null }),
}));

import { POST } from "./route";

const COACH_ID = "coach-1";

function request(body: unknown) {
    return new Request("http://localhost/api/coach/list-students", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function filtersOf(table: string) {
    return mocks.calls.find((c) => c.table === table)?.filters || [];
}

const subscription = (id: string, studentId: string, weeks: number) => ({
    id,
    student_id: studentId,
    tier: "2",
    status: "active",
    start_date: null,
    end_date: "2026-12-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00Z",
    subscribe_data: null,
    monthly_price: 19900,
    subscribed_weeks: weeks,
    prior_training_weeks: 0,
    created_at: "2026-09-01T00:00:00Z",
    order_id: null,
    last_payment_order_id: null,
    payment_method: "wechat",
    coaches: { user_id: "user-1" },
});

beforeEach(() => {
    mocks.started.length = 0;
    mocks.calls.length = 0;
    mocks.handlers = {
        coaches: () => ({ data: { id: COACH_ID }, error: null }),
        coach_subscriptions: () => ({
            data: [subscription("sub-1", "s1", 4), subscription("sub-2", "s2", 0)],
            count: 2,
            error: null,
        }),
        user_profiles: () => ({ data: [{ user_id: "s1", nickname: "小一" }], error: null }),
        training_videos: () => ({
            data: [
                { user_id: "s1", coach_feedback: { text: "好" } },
                { user_id: "s1", coach_feedback: {} },
            ],
            error: null,
        }),
        coach_plan_instances: () => ({
            data: [{
                id: "plan-1",
                coach_id: COACH_ID,
                coach_subscription_id: "sub-1",
                student_id: "s1",
                name: "增肌",
                description: null,
                status: "active",
                training_days_count: 2,
                start_execution_day: 1,
                created_at: "2026-09-02T00:00:00Z",
                training_days: [{ dayIndex: 1, type: "training" }, { dayIndex: 2, type: "training" }],
                executions: [{ id: "e1", instance_id: "plan-1", day_index: 1, status: "completed" }],
            }],
            error: null,
        }),
    };
});

describe("POST /api/coach/list-students", () => {
    it("keeps the response shape and drops the embedded coach filter", async () => {
        const res = await POST(request({ pagination: { page: 0, limit: 10 } }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.pagination).toEqual({ page: 0, limit: 10, total: 2 });
        const [first, second] = body.data.students;
        expect(first).not.toHaveProperty("coaches");
        expect(Object.keys(first).sort()).toEqual([
            "created_at", "end_date", "id", "last_payment_order_id", "monthly_price", "order_id",
            "payment_method", "plan", "prior_training_weeks", "profile", "progress", "reviewed",
            "start_date", "status", "student_id", "subscribe_data", "subscribed_weeks", "tier",
            "updated_at", "uploaded",
        ]);
        expect(first).toMatchObject({
            id: "sub-1",
            tier: 2,
            monthly_price: 199,
            profile: { user_id: "s1", nickname: "小一" },
            uploaded: 2,
            reviewed: 1,
            plan: { id: "plan-1", name: "增肌", status: "active", is_logically_completed: false },
            progress: { total: 2, completed: 1 },
        });
        expect(second).toMatchObject({
            id: "sub-2",
            profile: null,
            plan: null,
            progress: { total: 0, completed: 0 },
            uploaded: 0,
        });
    });

    it("filters subscriptions by the caller's coach via the embedded join", async () => {
        await POST(request({ pagination: { page: 1, limit: 5 } }));

        const subs = filtersOf("coach_subscriptions");
        expect(subs.find((f) => f.kind === "select")?.args[0]).toContain("coaches!inner(user_id)");
        expect(subs).toContainEqual({ kind: "eq", args: ["coaches.user_id", "user-1"] });
        expect(subs).toContainEqual({ kind: "eq", args: ["status", "active"] });
        expect(subs).toContainEqual({ kind: "range", args: [5, 9] });
        // 只有买了周数的订阅进入 carryover 分支
        expect(filtersOf("coach_plan_instances").find((f) => f.kind === "or")?.args[0])
            .toContain("coach_subscription_id.in.(sub-1),");
    });

    it("runs in three round-trip stages: coach+subscriptions, then everything else at once", async () => {
        let startedBeforeCoachResolved: string[] = [];
        mocks.handlers.coaches = () => {
            startedBeforeCoachResolved = [...mocks.started];
            return { data: { id: COACH_ID }, error: null };
        };
        const coachPlanHandler = mocks.handlers.coach_plan_instances;
        let startedBeforePlansResolved: string[] = [];
        mocks.handlers.coach_plan_instances = (ctx) => {
            startedBeforePlansResolved = [...mocks.started];
            return coachPlanHandler(ctx);
        };

        await POST(request({ pagination: { page: 0, limit: 10 } }));

        expect(startedBeforeCoachResolved).toEqual(expect.arrayContaining(["coaches", "coach_subscriptions"]));
        expect(startedBeforePlansResolved).toEqual(
            expect.arrayContaining(["user_profiles", "training_videos", "coach_plan_instances"]),
        );
        expect(mocks.started.filter((t) => t === "coach_plan_instances")).toHaveLength(1);
        expect(mocks.started).not.toContain("plan_instance_executions");
    });

    it("returns 400 for a non-coach even when the subscription query is empty", async () => {
        mocks.handlers.coaches = () => ({ data: null, error: null });
        mocks.handlers.coach_subscriptions = () => ({ data: [], count: 0, error: null });

        const res = await POST(request({ pagination: { page: 0, limit: 10 } }));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ success: false, message: "未找到教练身份" });
    });

    it("returns 400 for a non-coach before reporting search results", async () => {
        mocks.handlers.coaches = () => ({ data: null, error: null });
        mocks.handlers.user_profiles = () => ({ data: [], error: null });

        const res = await POST(request({ pagination: { page: 0, limit: 10 }, search: "无人" }));

        expect(res.status).toBe(400);
    });

    it("returns an empty page without loading page rows when search matches nobody", async () => {
        mocks.handlers.user_profiles = () => ({ data: [], error: null });

        const res = await POST(request({ pagination: { page: 0, limit: 10 }, search: "无人" }));
        const body = await res.json();

        expect(body.data).toEqual({ students: [], pagination: { page: 0, limit: 10, total: 0 } });
        // 只读了订阅 id 列表，没有再取整页订阅、计划或视频
        expect(mocks.started.filter((t) => t === "coach_subscriptions")).toHaveLength(1);
        expect(mocks.started).not.toContain("coach_plan_instances");
        expect(mocks.started).not.toContain("training_videos");
    });

    it("searches only within the coach's students and pages the matches in list order", async () => {
        mocks.handlers.user_profiles = (ctx) => ctx.filters.some((f) => f.kind === "or")
            ? { data: [{ user_id: "s2" }], error: null }
            : { data: [], error: null };

        const body = await (await POST(request({ pagination: { page: 0, limit: 10 }, search: "小二" }))).json();

        const searchCall = mocks.calls.find((c) => c.table === "user_profiles" && c.filters.some((f) => f.kind === "or"));
        expect(searchCall?.filters).toContainEqual({ kind: "in", args: ["user_id", ["s1", "s2"]] });
        expect(searchCall?.filters).toContainEqual({ kind: "or", args: ["nickname.ilike.%小二%,phone.ilike.%小二%"] });
        const pageCall = mocks.calls.find((c) => c.table === "coach_subscriptions" &&
            c.filters.some((f) => f.kind === "in" && f.args[0] === "id"));
        expect(pageCall?.filters).toContainEqual({ kind: "in", args: ["id", ["sub-2"]] });
        expect(pageCall?.filters).toContainEqual({ kind: "eq", args: ["coaches.user_id", "user-1"] });
        expect(body.data.pagination.total).toBe(1);
        expect(body.data.students.map((s: any) => s.id)).toEqual(["sub-2"]);
    });

    it("handles a broad search over many students without long id lists (regression: 500 Bad Request)", async () => {
        const many = Array.from({ length: 250 }, (_, i) => subscription(`sub-${i}`, `s${i}`, 0));
        mocks.handlers.coach_subscriptions = (ctx) => {
            const idFilter = ctx.filters.find((f) => f.kind === "in" && f.args[0] === "id");
            // in(id) 不保证顺序：故意倒序返回
            const rows = idFilter ? many.filter((row) => idFilter.args[1].includes(row.id)).reverse() : many;
            return { data: rows, count: rows.length, error: null };
        };
        // 宽泛关键词：每个学员都匹配
        mocks.handlers.user_profiles = (ctx) => {
            const ids: string[] = ctx.filters.find((f) => f.kind === "in")?.args[1] || [];
            return { data: ids.map((user_id) => ({ user_id })), error: null };
        };

        const res = await POST(request({ pagination: { page: 2, limit: 10 }, search: "1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.pagination.total).toBe(250);
        expect(body.data.students.map((s: any) => s.id)).toEqual(
            Array.from({ length: 10 }, (_, i) => `sub-${20 + i}`),
        );
        const idListSizes = mocks.calls.flatMap((c) => c.filters)
            .filter((f) => f.kind === "in")
            .map((f) => (f.args[1] as string[]).length);
        expect(Math.max(...idListSizes)).toBeLessThanOrEqual(100);
        expect(mocks.calls.some((c) => c.table === "coach_subscriptions" &&
            c.filters.some((f) => f.kind === "in" && f.args[0] === "student_id"))).toBe(false);
    });

    it("returns an empty page with the real total when searching past the last page", async () => {
        mocks.handlers.user_profiles = (ctx) => ctx.filters.some((f) => f.kind === "or")
            ? { data: [{ user_id: "s1" }, { user_id: "s2" }], error: null }
            : { data: [], error: null };

        const body = await (await POST(request({ pagination: { page: 3, limit: 10 }, search: "小" }))).json();

        expect(body.data).toEqual({ students: [], pagination: { page: 3, limit: 10, total: 2 } });
    });

    it("surfaces profile search errors as 500", async () => {
        mocks.handlers.user_profiles = () => ({ data: null, error: { message: "search failed" } });

        const res = await POST(request({ pagination: { page: 0, limit: 10 }, search: "小" }));

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ success: false, message: "search failed" });
    });

    it("returns an empty page with the real total past the last page (regression: 416 → 500)", async () => {
        mocks.handlers.coach_subscriptions = (ctx) => {
            const select = ctx.filters.find((f) => f.kind === "select");
            if (select?.args[1]?.head) return { data: null, count: 46, error: null };
            return {
                data: null,
                count: null,
                error: { code: "PGRST103", message: "Requested range not satisfiable" },
            };
        };

        const res = await POST(request({ pagination: { page: 9, limit: 10 } }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toEqual({ students: [], pagination: { page: 9, limit: 10, total: 46 } });
        const countCall = mocks.calls.find((c) => c.table === "coach_subscriptions" &&
            c.filters.find((f) => f.kind === "select")?.args[1]?.head);
        expect(countCall?.filters).toContainEqual({ kind: "eq", args: ["coaches.user_id", "user-1"] });
        expect(countCall?.filters).toContainEqual({ kind: "eq", args: ["status", "active"] });
        expect(mocks.started).not.toContain("coach_plan_instances");
    });

    it("surfaces subscription query errors as 500", async () => {
        mocks.handlers.coach_subscriptions = () => ({ data: null, count: null, error: { message: "boom" } });

        const res = await POST(request({ pagination: { page: 0, limit: 10 } }));

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ success: false, message: "boom" });
    });
});
