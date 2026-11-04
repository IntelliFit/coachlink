import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const mocks = vi.hoisted(() => ({
    jobs: [] as any[],
    onSubscriptionActivated: vi.fn(),
    pending: [] as Array<() => Promise<unknown>>,
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof import("next/server")>();
    return { ...actual, after: (task: () => Promise<unknown>) => { mocks.pending.push(task); } };
});
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    getServerSession: async () => ({ user: { id: "coach-user-1" } }),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: async () => ({ userId: null }) }));
vi.mock("@/lib/coachingAutomation", async () => {
    const jobs = await import("@/lib/coachingAutomation/jobs");
    return { isStaleRunningJob: jobs.isStaleRunningJob, onSubscriptionActivated: mocks.onSubscriptionActivated };
});
vi.mock("@/lib/supabaseClient", () => {
    const value = (ctx: SupabaseExecContext, column: string) =>
        ctx.filters.find((f) => f.kind === "eq" && f.args[0] === column)?.args[1];
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        if (ctx.table === "coaches") return { data: { id: "coach-1", user_id: "coach-user-1" }, error: null };
        if (ctx.table === "coach_automation_jobs") {
            const job = mocks.jobs.find((row) => row.id === value(ctx, "id") && row.coach_id === value(ctx, "coach_id"));
            return { data: job || null, error: null };
        }
        return { data: null, error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

import { POST } from "./route";

const retry = (jobId: string) => POST(new Request("http://localhost/api/coach/automation-jobs", {
    method: "POST",
    body: JSON.stringify({ action: "retry", jobId }),
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.pending = [];
    mocks.jobs = [
        { id: "job-mine", coach_id: "coach-1", type: "initial_plan", status: "failed", subscription_id: "sub-1", input_snapshot: { periodKey: "order-1" } },
        { id: "job-other", coach_id: "coach-2", type: "initial_plan", status: "failed", subscription_id: "sub-2", input_snapshot: {} },
        { id: "job-done", coach_id: "coach-1", type: "initial_plan", status: "succeeded", subscription_id: "sub-3", input_snapshot: {} },
        { id: "job-feedback", coach_id: "coach-1", type: "feedback_adjustment", status: "failed", subscription_id: "sub-1", input_snapshot: {} },
    ];
    mocks.onSubscriptionActivated.mockResolvedValue({ success: true });
});

describe("POST /api/coach/automation-jobs retry", () => {
    it("accepts the coach's own failed first-plan job and runs it after responding", async () => {
        const response = await retry("job-mine");

        expect(response.status).toBe(202);
        expect(mocks.onSubscriptionActivated).not.toHaveBeenCalled();
        await Promise.all(mocks.pending.map((task) => task()));
        expect(mocks.onSubscriptionActivated).toHaveBeenCalledWith("sub-1", "coach_retry", { periodKey: "order-1" });
    });

    it("does not reveal or run another coach's job", async () => {
        const response = await retry("job-other");

        expect(response.status).toBe(404);
        expect(mocks.pending).toHaveLength(0);
    });

    it("refuses jobs that did not fail or are not first plans", async () => {
        expect((await retry("job-done")).status).toBe(409);
        expect((await retry("job-feedback")).status).toBe(404);
        expect(mocks.pending).toHaveLength(0);
    });
});
