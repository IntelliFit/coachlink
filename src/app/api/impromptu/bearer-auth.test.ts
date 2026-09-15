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

vi.mock("@/lib/cos", () => ({
    cosRemove: vi.fn(),
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

describe("impromptu mobile bearer authentication", () => {
    beforeEach(() => {
        authMocks.getServerSession.mockReset().mockResolvedValue(null);
        authMocks.verifyToken.mockReset().mockReturnValue({ userId: "mobile-user" });
        databaseMocks.from.mockReset();
    });

    it.each([
        ["start", "/api/impromptu/start", { actions: [] }, () => import("./start/route")],
        ["get", "/api/impromptu/get", {}, () => import("./get/route")],
        ["complete item", "/api/impromptu/complete-item", {}, () => import("./complete-item/route")],
        ["complete set", "/api/impromptu/complete-set", {}, () => import("./complete-set/route")],
        ["finish", "/api/impromptu/finish", {}, () => import("./finish/route")],
        ["add extra set", "/api/impromptu/extra-content/add-extra-set", {}, () => import("./extra-content/add-extra-set/route")],
        ["delete extra set", "/api/impromptu/extra-content/delete-extra-set", {}, () => import("./extra-content/delete-extra-set/route")],
        ["add extra exercise", "/api/impromptu/extra-content/add-extra-exercise", {}, () => import("./extra-content/add-extra-exercise/route")],
        ["delete extra exercise", "/api/impromptu/extra-content/delete-extra-exercise", {}, () => import("./extra-content/delete-extra-exercise/route")],
    ])("accepts a valid bearer before validating %s input", async (_name, path, body, loadRoute) => {
        const { POST } = await loadRoute();
        const response = await POST(bearerRequest(path, body) as never);

        expect(response.status).toBe(400);
        expect(authMocks.verifyToken).toHaveBeenCalledWith("mobile-token");
    }, 60_000);

    it("rejects an invalid bearer before reading the current execution", async () => {
        authMocks.verifyToken.mockReturnValue(null);
        const { GET } = await import("./current/route");
        const response = await GET(new Request("http://localhost/api/impromptu/current", {
            headers: { Authorization: "Bearer invalid-token" },
        }));

        expect(response.status).toBe(401);
    });

    it("does not let a bearer token update another student's execution", async () => {
        const update = vi.fn();
        const builder: any = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            single: vi.fn().mockResolvedValue({
                data: {
                    id: "execution-1",
                    student_id: "another-user",
                    status: "in_progress",
                    action_executions: [],
                },
                error: null,
            }),
            update,
        };
        databaseMocks.from.mockReturnValue(builder);

        const { POST } = await import("./complete-set/route");
        const response = await POST(bearerRequest("/api/impromptu/complete-set", {
            executionId: "execution-1",
            actionIndex: 0,
            setIndex: 0,
            actualWeight: 20,
            actualReps: 5,
        }));

        expect(response.status).toBe(403);
        expect(update).not.toHaveBeenCalled();
    });
});
