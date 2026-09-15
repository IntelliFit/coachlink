import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
    getServerSession: vi.fn(),
    verifyToken: vi.fn(),
}));
const databaseMocks = vi.hoisted(() => ({ from: vi.fn() }));

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
    buildDatedKey: vi.fn(() => "test/video.mp4"),
    cosRemove: vi.fn(),
    cosUpload: vi.fn(),
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

describe("planned execution mobile bearer authentication", () => {
    beforeEach(() => {
        authMocks.getServerSession.mockReset().mockResolvedValue(null);
        authMocks.verifyToken.mockReset().mockReturnValue({ userId: "mobile-user" });
        databaseMocks.from.mockReset();
    });

    it.each([
        ["complete item", "/api/execution/complete-item", () => import("./complete-item/route")],
        ["complete set", "/api/execution/complete-set", () => import("./complete-set/route")],
        ["finish", "/api/execution/finish", () => import("./finish/route")],
        ["skip day", "/api/execution/skip-day", () => import("./skip-day/route")],
        ["submit feedback", "/api/execution/submit-feedback", () => import("./submit-feedback/route")],
        ["add extra set", "/api/execution/extra-content/add-extra-set", () => import("./extra-content/add-extra-set/route")],
        ["delete extra set", "/api/execution/extra-content/delete-extra-set", () => import("./extra-content/delete-extra-set/route")],
        ["add extra exercise", "/api/execution/extra-content/add-extra-exercise", () => import("./extra-content/add-extra-exercise/route")],
        ["delete extra exercise", "/api/execution/extra-content/delete-extra-exercise", () => import("./extra-content/delete-extra-exercise/route")],
        ["add video link", "/api/execution/add-set-video-link", () => import("./add-set-video-link/route")],
        ["create PR", "/api/execution/create-pr", () => import("./create-pr/route")],
        ["delete PR", "/api/execution/delete-pr-record", () => import("./delete-pr-record/route")],
        ["share info", "/api/execution/share-info", () => import("./share-info/route")],
    ])("accepts a valid bearer before validating %s input", async (_name, path, loadRoute) => {
        const { POST } = await loadRoute();
        const response = await POST(bearerRequest(path) as never);

        expect(response.status).not.toBe(401);
        expect(authMocks.verifyToken).toHaveBeenCalledWith("mobile-token");
    }, 30_000);

    it("accepts bearer authentication for multipart set-video uploads", async () => {
        const form = new FormData();
        const { POST } = await import("./upload-set-video/route");
        const response = await POST(new Request("http://localhost/api/execution/upload-set-video", {
            method: "POST",
            headers: { Authorization: "Bearer mobile-token" },
            body: form,
        }));

        expect(response.status).toBe(400);
        expect(authMocks.verifyToken).toHaveBeenCalledWith("mobile-token");
    }, 30_000);

    it("rejects an invalid bearer before reading an execution", async () => {
        authMocks.verifyToken.mockReturnValue(null);
        const { POST } = await import("./complete-set/route");
        const response = await POST(bearerRequest("/api/execution/complete-set") as never);

        expect(response.status).toBe(401);
    });
});
