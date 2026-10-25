import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";
import { PUBLIC_PROFILE_COLUMNS } from "@/lib/profileAccess";

const VIEWER_ID = "viewer-1";
const STUDENT_ID = "student-1";
const STRANGER_ID = "stranger-1";

const mocks = vi.hoisted(() => ({
    session: null as { user: { id: string; is_admin?: boolean } } | null,
    coachStudentPairs: [] as Array<[string, string]>,
    contexts: [] as any[],
}));

function eqValue(ctx: SupabaseExecContext, column: string) {
    return ctx.filters.find((f) => f.kind === "eq" && f.args[0] === column)?.args[1];
}

function selectColumns(ctx: SupabaseExecContext) {
    return ctx.filters.find((f) => f.kind === "select")?.args[0];
}

vi.mock("@/lib/supabaseClient", () => {
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        mocks.contexts.push(ctx);
        if (ctx.table === "coach_subscriptions") {
            const coachUserId = eqValue(ctx, "coaches.user_id");
            const studentId = eqValue(ctx, "student_id");
            const matched = mocks.coachStudentPairs.some(([c, s]) => c === coachUserId && s === studentId);
            return { data: matched ? { id: "sub-1" } : null, error: null };
        }
        if (ctx.table === "user_profiles") {
            const userId = eqValue(ctx, "user_id");
            return {
                data: {
                    id: `profile-${userId}`,
                    user_id: userId,
                    nickname: `nick-${userId}`,
                    avatar_url: null,
                    phone: "13800000000",
                    address: "secret address",
                    birth_date: "1990-01-01",
                },
                error: null,
            };
        }
        return { data: null, error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    getServerSession: async () => mocks.session,
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
    return new Request("http://localhost/api/user/get-profile", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function profileQuery() {
    return mocks.contexts.find((ctx) => ctx.table === "user_profiles") as SupabaseExecContext;
}

describe("POST /api/user/get-profile", () => {
    beforeEach(() => {
        mocks.session = { user: { id: VIEWER_ID } };
        mocks.coachStudentPairs = [];
        mocks.contexts = [];
    });

    it("rejects unauthenticated callers", async () => {
        mocks.session = null;
        const res = await POST(request({}));
        expect(res.status).toBe(401);
        expect(mocks.contexts).toHaveLength(0);
    });

    it("returns the caller's own full profile without a relationship lookup", async () => {
        const res = await POST(request({}));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(eqValue(profileQuery(), "user_id")).toBe(VIEWER_ID);
        expect(selectColumns(profileQuery())).toBe("*");
        expect(json.data.profile.phone).toBe("13800000000");
        expect(mocks.contexts.some((ctx) => ctx.table === "coach_subscriptions")).toBe(false);
    });

    it("treats an explicit own userId the same as self", async () => {
        await POST(request({ userId: VIEWER_ID }));
        expect(selectColumns(profileQuery())).toBe("*");
    });

    it("limits another user's profile to public columns", async () => {
        const res = await POST(request({ userId: STRANGER_ID }));

        expect(res.status).toBe(200);
        expect(eqValue(profileQuery(), "user_id")).toBe(STRANGER_ID);
        expect(selectColumns(profileQuery())).toBe(PUBLIC_PROFILE_COLUMNS);
        expect(PUBLIC_PROFILE_COLUMNS).not.toMatch(/phone|address|birth_date|full_name|\*/);
    });

    it("returns the full profile to the student's coach", async () => {
        mocks.coachStudentPairs = [[VIEWER_ID, STUDENT_ID]];
        await POST(request({ userId: STUDENT_ID }));

        const relationQuery = mocks.contexts.find((ctx) => ctx.table === "coach_subscriptions");
        expect(eqValue(relationQuery, "coaches.user_id")).toBe(VIEWER_ID);
        expect(eqValue(relationQuery, "student_id")).toBe(STUDENT_ID);
        expect(selectColumns(profileQuery())).toBe("*");
    });

    it("does not grant a coach access to someone else's student", async () => {
        mocks.coachStudentPairs = [["other-coach", STUDENT_ID]];
        await POST(request({ userId: STUDENT_ID }));
        expect(selectColumns(profileQuery())).toBe(PUBLIC_PROFILE_COLUMNS);
    });

    it("returns the full profile to admins", async () => {
        mocks.session = { user: { id: VIEWER_ID, is_admin: true } };
        await POST(request({ userId: STRANGER_ID }));
        expect(selectColumns(profileQuery())).toBe("*");
    });

    it("rejects a non-string userId", async () => {
        const res = await POST(request({ userId: { $ne: null } }));
        expect(res.status).toBe(400);
        expect(mocks.contexts).toHaveLength(0);
    });
});
