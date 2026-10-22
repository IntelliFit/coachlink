import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseExecContext } from "@/testUtils/mockSupabase";

const mocks = vi.hoisted(() => ({
    headers: vi.fn(),
    nextAuthSession: vi.fn(),
    verifyToken: vi.fn(),
    adminCredential: vi.fn(),
    exec: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next-auth", () => ({ getServerSession: mocks.nextAuthSession }));
vi.mock("../../auth/[...nextauth]/route", () => ({ authOptions: {} }));
vi.mock("@/lib/jwt", () => ({ verifyToken: mocks.verifyToken }));
vi.mock("@/lib/adminCredentials", () => ({ getAdminCredentialByUserId: mocks.adminCredential }));
vi.mock("@/lib/supabaseClient", async () => {
    const { createMockSupabase: create } = await import("@/testUtils/mockSupabase");
    const client = create((ctx) => mocks.exec(ctx));
    return { default: client, serviceRoleSupabase: client };
});

import { getServerSession } from "./auth";
import { getAuthUser } from "@/lib/auth";

const TOKEN = "valid-token";
const USER_ID = "user-1";

type Rows = { users?: any; coaches?: any; user_profiles?: any; usersError?: any };

/** 记录每张表的查询次数，以及同时在途的最大请求数（用于确认并行）。 */
function setupDatabase(rows: Rows, adminCredential: any = null) {
    const calls: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const track = async <T>(name: string, value: () => T): Promise<T> => {
        calls.push(name);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return value();
    };

    mocks.exec.mockImplementation((ctx: SupabaseExecContext) =>
        track(ctx.table, () => {
            if (ctx.table === "users") {
                return rows.users
                    ? { data: rows.users, error: null }
                    : { data: null, error: rows.usersError ?? { code: "PGRST116", message: "no rows" } };
            }
            if (ctx.table === "coaches") return { data: rows.coaches ?? null, error: null };
            if (ctx.table === "user_profiles") return { data: rows.user_profiles ?? null, error: null };
            throw new Error(`Unexpected table ${ctx.table}`);
        }),
    );
    mocks.adminCredential.mockImplementation(() => track("admin_users", () => adminCredential));

    return { calls, maxInFlight: () => maxInFlight };
}

function bearerRequest(token = TOKEN) {
    return new Request("http://localhost/api/test", { headers: { authorization: `Bearer ${token}` } });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.nextAuthSession.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(new Headers({ authorization: `Bearer ${TOKEN}` }));
    mocks.verifyToken.mockImplementation((token: string) => (token === TOKEN ? { userId: USER_ID } : null));
});

describe("getServerSession (Bearer token)", () => {
    it("builds a student session and runs the follow-up queries in parallel", async () => {
        const db = setupDatabase({
            users: { id: USER_ID, phone: "13800000000", email: null, is_admin: false, primary_role: null },
            user_profiles: { user_id: USER_ID, full_name: "", nickname: "小明" },
        });

        const session = await getServerSession();

        expect(session).toMatchObject({
            user: {
                id: USER_ID,
                name: "小明",
                phone: "13800000000",
                email: null,
                is_coach: false,
                is_admin: false,
                coach_status: "none",
                primary_role: "student",
            },
            profile: { nickname: "小明" },
        });
        expect(session.user).not.toHaveProperty("has_admin_credential");
        expect(db.calls).toEqual(["users", "coaches", "user_profiles"]);
        expect(db.maxInFlight()).toBe(2);
        expect(mocks.adminCredential).not.toHaveBeenCalled();
    });

    it("marks approved coaches and keeps an explicit primary_role", async () => {
        setupDatabase({
            users: { id: USER_ID, phone: null, email: "c@example.com", is_admin: null, primary_role: "student" },
            coaches: { id: "coach-1", status: "approved" },
        });

        const session = await getServerSession();

        expect(session.user).toMatchObject({
            name: "c@example.com",
            is_coach: true,
            is_admin: false,
            coach_status: "approved",
            primary_role: "student",
        });
        expect(session.profile).toBeUndefined();
    });

    it("treats a non-approved coach row as a student", async () => {
        setupDatabase({
            users: { id: USER_ID, phone: "1", email: null, is_admin: false },
            coaches: { id: "coach-1", status: "pending" },
        });

        const session = await getServerSession();

        expect(session.user).toMatchObject({ is_coach: false, coach_status: "none", primary_role: "student" });
    });

    it("fetches the admin credential alongside the profile queries", async () => {
        const db = setupDatabase(
            {
                users: { id: USER_ID, phone: "1", email: null, is_admin: true, primary_role: "admin" },
                coaches: { id: "coach-1", status: "approved" },
            },
            { is_active: true, login_identifier: "admin", password_hash: "hash" },
        );

        const session = await getServerSession();

        expect(session.user).toMatchObject({ is_admin: true, has_admin_credential: true, primary_role: "admin" });
        expect(mocks.adminCredential).toHaveBeenCalledWith(USER_ID);
        expect(db.maxInFlight()).toBe(3);
    });

    it("reports a missing or inactive admin credential", async () => {
        setupDatabase(
            { users: { id: USER_ID, phone: "1", email: null, is_admin: true } },
            { is_active: false, login_identifier: "admin", password_hash: "hash" },
        );

        const session = await getServerSession();

        expect(session.user.has_admin_credential).toBe(false);
    });

    it("returns null when the admin credential lookup fails", async () => {
        setupDatabase({ users: { id: USER_ID, phone: "1", email: null, is_admin: true } });
        mocks.adminCredential.mockRejectedValue(new Error("admin_users unavailable"));

        await expect(getServerSession()).resolves.toBeNull();
    });

    it("returns null for an invalid token without touching the database", async () => {
        setupDatabase({});
        mocks.headers.mockResolvedValue(new Headers({ authorization: "Bearer forged" }));

        await expect(getServerSession()).resolves.toBeNull();
        expect(mocks.exec).not.toHaveBeenCalled();
    });

    it("returns null when the user no longer exists", async () => {
        const db = setupDatabase({});

        await expect(getServerSession()).resolves.toBeNull();
        expect(db.calls).toEqual(["users"]);
    });

    it("returns null without a Bearer header", async () => {
        mocks.headers.mockResolvedValue(new Headers());

        await expect(getServerSession()).resolves.toBeNull();
        expect(mocks.verifyToken).not.toHaveBeenCalled();
    });

    it("prefers the NextAuth cookie session", async () => {
        const cookieSession = { user: { id: "web-user", is_admin: false } };
        mocks.nextAuthSession.mockResolvedValue(cookieSession);

        await expect(getServerSession()).resolves.toBe(cookieSession);
        expect(mocks.headers).not.toHaveBeenCalled();
    });
});

describe("getAuthUser (Bearer token)", () => {
    it("returns the session user with a single users query", async () => {
        const db = setupDatabase({ users: { id: USER_ID, phone: "1", email: null, is_admin: false } });

        const result = await getAuthUser(bearerRequest());

        expect(result).toMatchObject({ isAuthenticated: true, userId: USER_ID, user: { id: USER_ID } });
        expect(db.calls.filter((table) => table === "users")).toHaveLength(1);
    });

    it("does not query users again when the user does not exist", async () => {
        const db = setupDatabase({});

        const result = await getAuthUser(bearerRequest());

        expect(result).toEqual({ userId: null, user: null, isAuthenticated: false });
        expect(db.calls).toEqual(["users"]);
    });

    it("rejects an invalid token without touching the database", async () => {
        setupDatabase({});
        mocks.headers.mockResolvedValue(new Headers({ authorization: "Bearer forged" }));

        const result = await getAuthUser(bearerRequest("forged"));

        expect(result.isAuthenticated).toBe(false);
        expect(mocks.exec).not.toHaveBeenCalled();
    });

    it("retries the users lookup after a transient database error", async () => {
        let attempts = 0;
        mocks.exec.mockImplementation((ctx: SupabaseExecContext) => {
            attempts += 1;
            return attempts === 1
                ? { data: null, error: { code: "500", message: "timeout" } }
                : { data: { id: ctx.filters.find((f) => f.kind === "eq")?.args[1], password_hash: "x" }, error: null };
        });

        const result = await getAuthUser(bearerRequest());

        expect(result).toEqual({ userId: USER_ID, user: { id: USER_ID }, isAuthenticated: true });
        expect(attempts).toBe(2);
    });

    it("falls back to the request header outside a Next.js request scope", async () => {
        setupDatabase({ users: { id: USER_ID, phone: "1", password_hash: "x" } });
        mocks.headers.mockRejectedValue(new Error("headers() called outside a request scope"));

        const result = await getAuthUser(bearerRequest());

        expect(result).toEqual({ userId: USER_ID, user: { id: USER_ID, phone: "1" }, isAuthenticated: true });
    });

    it("authenticates via the users row when the admin credential lookup fails", async () => {
        setupDatabase({ users: { id: USER_ID, phone: "1", is_admin: true, password_hash: "x" } });
        mocks.adminCredential.mockRejectedValue(new Error("admin_users unavailable"));

        const result = await getAuthUser(bearerRequest());

        expect(result).toEqual({
            userId: USER_ID,
            user: { id: USER_ID, phone: "1", is_admin: true },
            isAuthenticated: true,
        });
    });
});
