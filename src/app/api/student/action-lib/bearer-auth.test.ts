import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
    getServerSession: vi.fn(),
    verifyToken: vi.fn(),
}));
const databaseMocks = vi.hoisted(() => ({
    from: vi.fn(),
}));

vi.mock("next-auth", () => ({
    getServerSession: authMocks.getServerSession,
}));

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
    authOptions: {},
}));

vi.mock("@/lib/jwt", () => ({
    verifyToken: authMocks.verifyToken,
}));

vi.mock("@/lib/supabaseClient", () => ({
    default: { from: databaseMocks.from },
    serviceRoleSupabase: { from: databaseMocks.from },
}));

function bearerRequest(path: string, body: unknown = {}) {
    return new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
            Authorization: "Bearer mobile-token",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

describe("student action library mobile bearer authentication", () => {
    beforeEach(() => {
        authMocks.getServerSession.mockReset().mockResolvedValue(null);
        authMocks.verifyToken.mockReset().mockReturnValue({ userId: "mobile-user" });
        databaseMocks.from.mockReset();
    });

    it.each([
        ["add", "/api/student/action-lib/add-action", () => import("./add-action/route")],
        ["update", "/api/student/action-lib/update-action", () => import("./update-action/route")],
        ["delete", "/api/student/action-lib/delete-action", () => import("./delete-action/route")],
        ["copy coach action", "/api/student/action-lib/copy-coach-action", () => import("./copy-coach-action/route")],
    ])("accepts a valid bearer before validating %s input", async (_name, path, loadRoute) => {
        const { POST } = await loadRoute();
        const response = await POST(bearerRequest(path) as never);

        expect(response.status).toBe(400);
        expect(authMocks.verifyToken).toHaveBeenCalledWith("mobile-token");
    }, 15_000);

    it("allows public actions to reach input validation with a valid bearer", async () => {
        const { POST } = await import("../../public-action-lib/add-to-my-lib/route");
        const response = await POST(bearerRequest("/api/public-action-lib/add-to-my-lib"));

        expect(response.status).toBe(400);
        expect(authMocks.verifyToken).toHaveBeenCalledWith("mobile-token");
    });

    it("rejects invalid bearer tokens for the subscribed coach action list", async () => {
        authMocks.verifyToken.mockReturnValue(null);
        const { POST } = await import("./list-coach-actions/route");
        const response = await POST(bearerRequest("/api/student/action-lib/list-coach-actions"));

        expect(response.status).toBe(401);
    });

    it("keeps the active coach subscription guard when copying an action", async () => {
        const builder: any = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            order: vi.fn(() => builder),
            limit: vi.fn(() => builder),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        };
        databaseMocks.from.mockReturnValue(builder);

        const { POST } = await import("./copy-coach-action/route");
        const response = await POST(bearerRequest("/api/student/action-lib/copy-coach-action", {
            coachActionId: "coach-action-1",
        }));

        expect(response.status).toBe(403);
        expect(databaseMocks.from).toHaveBeenCalledTimes(1);
        expect(databaseMocks.from).toHaveBeenCalledWith("coach_subscriptions");
    });

    it("does not let a student target the coach action library", async () => {
        const builder: any = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            maybeSingle: vi.fn().mockResolvedValue({ data: { is_coach: false }, error: null }),
        };
        databaseMocks.from.mockReturnValue(builder);

        const { POST } = await import("../../public-action-lib/add-to-my-lib/route");
        const response = await POST(bearerRequest("/api/public-action-lib/add-to-my-lib", {
            actionId: "public-action-1",
            targetActionType: "coach",
        }));

        expect(response.status).toBe(403);
        expect(databaseMocks.from).toHaveBeenCalledTimes(1);
        expect(databaseMocks.from).toHaveBeenCalledWith("users");
    });
});
