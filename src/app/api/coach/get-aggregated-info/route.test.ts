import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const QUERY_LATENCY_MS = 30;

const mocks = vi.hoisted(() => ({
    handlers: {} as Record<string, (ctx: any) => any>,
    started: [] as string[],
    redisGet: vi.fn(),
    redisSetEx: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
    default: createMockSupabase(async (ctx: SupabaseExecContext) => {
        mocks.started.push(ctx.table);
        await new Promise((resolve) => setTimeout(resolve, QUERY_LATENCY_MS));
        const handler = mocks.handlers[ctx.table];
        return handler ? handler(ctx) : { data: [], error: null };
    }),
}));

vi.mock("@/lib/redisClient", () => ({
    default: { get: mocks.redisGet, setEx: mocks.redisSetEx },
}));

vi.mock("@/lib/coachViewer", () => ({
    getCoachViewer: async () => ({ userId: null, isAdmin: false }),
}));

import { POST } from "./route";

const COACH_ID = "coach-1";

function request(body: unknown) {
    return new Request("http://localhost/api/coach/get-aggregated-info", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function hasEq(ctx: SupabaseExecContext, column: string, value: unknown) {
    return ctx.filters.some((f) => f.kind === "eq" && f.args[0] === column && f.args[1] === value);
}

beforeEach(() => {
    mocks.started.length = 0;
    mocks.redisGet.mockReset();
    mocks.redisSetEx.mockReset().mockResolvedValue("OK");
    mocks.handlers = {
        coaches: () => ({
            data: {
                id: COACH_ID,
                user_id: "user-1",
                name: "教练",
                avatar_url: null,
                specialties: ["力量举"],
                profile: {},
                invitation_code: "666666",
            },
            error: null,
        }),
        coach_applications: () => ({ data: { title: "申请头衔", teaching_philosophy: "循序渐进" }, error: null }),
        user_profiles: () => ({ data: { avatar_url: "https://img/profile.png" }, error: null }),
        coach_subscriptions: (ctx) => ({ data: null, error: null, count: hasEq(ctx, "status", "active") ? 46 : 0 }),
        coach_contents: () => ({ data: null, error: null, count: 7 }),
        coach_plan_templates: () => ({ data: [{ tags: ["减脂", "力量举"] }, { tags: null }], error: null }),
        student_comments: () => ({ data: [{ rating: 5 }, { rating: 4 }], error: null }),
    };
});

describe("POST /api/coach/get-aggregated-info", () => {
    it("returns the aggregated shape with the application and avatar fallbacks applied", async () => {
        mocks.redisGet.mockResolvedValue(null);

        const res = await POST(request({ coachId: COACH_ID }));
        const body = await res.json();

        expect(body.success).toBe(true);
        expect(Object.keys(body.data).sort()).toEqual(
            ["averageRating", "coach", "contentCount", "reviewCount", "specialties", "studentCount"],
        );
        expect(body.data).toMatchObject({
            contentCount: 7,
            studentCount: 46,
            reviewCount: 2,
            averageRating: 4.5,
            specialties: ["力量举", "减脂"],
        });
        expect(body.data.coach).toMatchObject({
            title: "申请头衔",
            avatar_url: "https://img/profile.png",
            profile: { teachingPhilosophy: "循序渐进" },
        });
        expect(body.data.coach).not.toHaveProperty("invitation_code");
        expect(mocks.redisSetEx).toHaveBeenCalledWith(
            `coach:reviews:${COACH_ID}`,
            300,
            JSON.stringify({ reviewCount: 2, averageRating: 4.5 }),
        );
    });

    it("does not wait on an unreachable Redis", async () => {
        mocks.redisGet.mockReturnValue(new Promise(() => undefined));
        mocks.redisSetEx.mockReturnValue(new Promise(() => undefined));

        const startedAt = Date.now();
        const body = await (await POST(request({ coachId: COACH_ID }))).json();

        expect(Date.now() - startedAt).toBeLessThan(2000);
        expect(body.data).toMatchObject({ reviewCount: 2, averageRating: 4.5 });
    });

    it("serves review stats from the cache without querying student_comments", async () => {
        mocks.redisGet.mockResolvedValue(JSON.stringify({ reviewCount: 9, averageRating: 4.8 }));

        const body = await (await POST(request({ coachId: COACH_ID }))).json();

        expect(body.data).toMatchObject({ reviewCount: 9, averageRating: 4.8 });
        expect(mocks.started).not.toContain("student_comments");
        expect(mocks.redisSetEx).not.toHaveBeenCalled();
    });

    it("starts the coachId-only counts alongside the coach lookup, not after it", async () => {
        mocks.redisGet.mockResolvedValue(null);
        let startedBeforeCoachResolved: string[] = [];
        mocks.handlers.coaches = () => {
            startedBeforeCoachResolved = [...mocks.started];
            return { data: { id: COACH_ID, user_id: "user-1", avatar_url: "https://img/a.png" }, error: null };
        };

        await POST(request({ coachId: COACH_ID }));

        expect(startedBeforeCoachResolved).toEqual(
            expect.arrayContaining(["coaches", "coach_subscriptions", "coach_contents", "student_comments"]),
        );
        // 教练已有头像时不再查 user_profiles
        expect(mocks.started).not.toContain("user_profiles");
    });

    it("keeps the not-found response", async () => {
        mocks.redisGet.mockResolvedValue(null);
        mocks.handlers.coaches = () => ({ data: null, error: { message: "not found" } });

        const body = await (await POST(request({ coachId: "missing" }))).json();

        expect(body).toEqual({ success: false, message: "教练信息不存在", data: null });
    });

    it("rejects a missing coachId", async () => {
        const res = await POST(request({}));
        expect(res.status).toBe(400);
    });
});
