import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";
import { PUBLIC_PROFILE_COLUMNS } from "@/lib/profileAccess";

const VIEWER_ID = "viewer-1";
const STUDENT_ID = "student-1";
const STRANGER_ID = "stranger-1";

const mocks = vi.hoisted(() => ({
    auth: { isAuthenticated: true, userId: "viewer-1" as string | null, user: {} as any },
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
            return { data: { user_id: eqValue(ctx, "user_id"), nickname: "nick" }, error: null };
        }
        if (ctx.table === "onboarding_questionnaires") {
            return { data: { id: "q-1" }, error: null };
        }
        return { data: [{ id: `${ctx.table}-row` }], error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("@/lib/auth", () => ({
    getAuthUser: async () => mocks.auth,
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
    return new Request("http://localhost/api/user/get-student-profile", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function tablesQueried() {
    return mocks.contexts.map((ctx) => ctx.table);
}

function profileQuery() {
    return mocks.contexts.find((ctx) => ctx.table === "user_profiles") as SupabaseExecContext;
}

describe("POST /api/user/get-student-profile", () => {
    beforeEach(() => {
        mocks.auth = { isAuthenticated: true, userId: VIEWER_ID, user: {} };
        mocks.coachStudentPairs = [];
        mocks.contexts = [];
    });

    it("rejects unauthenticated callers", async () => {
        mocks.auth = { isAuthenticated: false, userId: null, user: null };
        const res = await POST(request({}));
        expect(res.status).toBe(401);
        expect(mocks.contexts).toHaveLength(0);
    });

    it("returns the caller's own full aggregate", async () => {
        const res = await POST(request({ userId: VIEWER_ID }));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(selectColumns(profileQuery())).toBe("*");
        expect(json.data.questionnaire).toEqual({ id: "q-1" });
        expect(json.data.videos).toHaveLength(1);
        expect(json.data.lifestyle).toHaveLength(1);
        expect(tablesQueried()).not.toContain("coach_subscriptions");
    });

    it("returns only a public profile card for another user", async () => {
        const res = await POST(request({ userId: STRANGER_ID }));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(selectColumns(profileQuery())).toBe(PUBLIC_PROFILE_COLUMNS);
        expect(json.data).toEqual({
            profile: { user_id: STRANGER_ID, nickname: "nick" },
            questionnaire: null,
            videos: [],
            lifestyle: [],
        });
        expect(tablesQueried()).not.toContain("onboarding_questionnaires");
        expect(tablesQueried()).not.toContain("training_videos");
        expect(tablesQueried()).not.toContain("lifestyle_logs");
    });

    it("returns the full aggregate to the student's coach", async () => {
        mocks.coachStudentPairs = [[VIEWER_ID, STUDENT_ID]];
        const res = await POST(request({ userId: STUDENT_ID }));
        const json = await res.json();

        expect(selectColumns(profileQuery())).toBe("*");
        expect(json.data.questionnaire).toEqual({ id: "q-1" });
        expect(tablesQueried()).toContain("training_videos");
    });

    it("returns the full aggregate to admins", async () => {
        mocks.auth = { isAuthenticated: true, userId: VIEWER_ID, user: { is_admin: true } };
        await POST(request({ userId: STRANGER_ID }));
        expect(selectColumns(profileQuery())).toBe("*");
    });

    it("rejects a non-string userId", async () => {
        const res = await POST(request({ userId: ["a", "b"] }));
        expect(res.status).toBe(400);
        expect(mocks.contexts).toHaveLength(0);
    });
});
