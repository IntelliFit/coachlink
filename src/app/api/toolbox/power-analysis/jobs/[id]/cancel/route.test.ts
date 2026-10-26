import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  calls: [] as SupabaseExecContext[],
  rows: {} as Record<string, any>,
  // Status the row moves to just before the cancel update lands (simulates the worker finishing).
  raceTo: null as string | null,
  removed: [] as string[][],
}));

function filterValue(ctx: SupabaseExecContext, kind: string, column: string) {
  return ctx.filters.find((f) => f.kind === kind && f.args[0] === column)?.args[1];
}

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
  getServerSession: async () => mocks.session,
}));

vi.mock("@/lib/supabaseClient", () => {
  const client: any = createMockSupabase((ctx) => {
    mocks.calls.push(ctx);
    const id = filterValue(ctx, "eq", "id");
    const row = mocks.rows[id];
    if (ctx.op === "select") {
      const owner = filterValue(ctx, "eq", "user_id");
      return { data: row && row.user_id === owner ? { ...row } : null, error: null };
    }
    if (ctx.op === "update") {
      if (row && mocks.raceTo) row.status = mocks.raceTo;
      const allowed: string[] = filterValue(ctx, "in", "status") || [];
      if (!row || !allowed.includes(row.status)) return { data: null, error: null };
      Object.assign(row, ctx.payload);
      return { data: { ...row }, error: null };
    }
    return { data: null, error: null };
  });
  client.storage = {
    from: () => ({
      remove: async (paths: string[]) => {
        mocks.removed.push(paths);
        return { data: null, error: null };
      },
    }),
  };
  return { default: client, serviceRoleSupabase: client };
});

import { POST } from "./route";

const USER_ID = "user-1";

function job(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    user_id: USER_ID,
    mode: "pullup",
    height_cm: 180,
    weight_kg: 70,
    status,
    progress: 40,
    input_storage_bucket: "videos",
    input_storage_path: "toolbox/power-analysis/tmp/user-1/job-1/input.mp4",
    output_storage_path: null,
    metadata: {},
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    created_at: new Date().toISOString(),
    ...extra,
  };
}

function cancel(id = "job-1") {
  return POST(new Request(`http://localhost/api/toolbox/power-analysis/jobs/${id}/cancel`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

function updates() {
  return mocks.calls.filter((c) => c.op === "update");
}

beforeEach(() => {
  mocks.session = { user: { id: USER_ID } };
  mocks.calls = [];
  mocks.rows = {};
  mocks.raceTo = null;
  mocks.removed = [];
});

describe("POST /api/toolbox/power-analysis/jobs/[id]/cancel", () => {
  it("requires login", async () => {
    mocks.session = null;
    const res = await cancel();
    expect(res.status).toBe(401);
    expect(mocks.calls).toHaveLength(0);
  });

  it("does not reveal or touch another user's job", async () => {
    mocks.rows["job-1"] = job("processing", { user_id: "someone-else" });
    const res = await cancel();
    expect(res.status).toBe(404);
    expect(updates()).toHaveLength(0);
    expect(mocks.rows["job-1"].status).toBe("processing");
  });

  it.each(["awaiting_upload", "queued", "processing"])("cancels a %s job and removes its upload", async (status) => {
    mocks.rows["job-1"] = job(status);
    const res = await cancel();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("canceled");
    const [update] = updates();
    expect(update.payload.status).toBe("canceled");
    expect(filterValue(update, "in", "status")).toEqual(["awaiting_upload", "queued", "processing"]);
    expect(mocks.removed).toEqual([["toolbox/power-analysis/tmp/user-1/job-1/input.mp4"]]);
  });

  it("is idempotent for an already canceled job", async () => {
    mocks.rows["job-1"] = job("canceled");
    const res = await cancel();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.status).toBe("canceled");
    expect(updates()).toHaveLength(0);
  });

  it("refuses to cancel a finished job", async () => {
    mocks.rows["job-1"] = job("done");
    const res = await cancel();
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.message).toBe("分析已经完成，无需取消");
    expect(updates()).toHaveLength(0);
    expect(mocks.removed).toHaveLength(0);
  });

  it("reports the finished state when the worker completes the job first", async () => {
    mocks.rows["job-1"] = job("processing");
    mocks.raceTo = "done";
    const res = await cancel();
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.message).toBe("分析已经完成，无需取消");
    expect(mocks.rows["job-1"].status).toBe("done");
    expect(mocks.removed).toHaveLength(0);
  });
});
