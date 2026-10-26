import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  calls: [] as SupabaseExecContext[],
  activeRows: [] as any[],
}));

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
  getServerSession: async () => mocks.session,
}));

vi.mock("@/lib/supabaseClient", () => {
  const client: any = createMockSupabase((ctx) => {
    mocks.calls.push(ctx);
    // Queue-position counts (head: true) and the stale-job scan both read this table too.
    if (ctx.filters.some((f) => f.kind === "select" && f.args[1]?.head)) return { data: null, error: null, count: 0 };
    return { data: mocks.activeRows, error: null };
  });
  return { default: client, serviceRoleSupabase: client };
});

import { GET } from "./route";

const USER_ID = "user-1";

function activeJob(status: string) {
  const now = Date.now();
  return {
    id: "job-1",
    user_id: USER_ID,
    mode: "back_squat",
    height_cm: 180,
    weight_kg: 70,
    status,
    progress: 30,
    metadata: { external_load_kg: 100, plate_diameter_cm: 45 },
    enqueued_at: new Date(now - 60_000).toISOString(),
    updated_at: new Date(now - 30_000).toISOString(),
    expires_at: new Date(now + 3600_000).toISOString(),
    created_at: new Date(now - 120_000).toISOString(),
  };
}

function lastListQuery() {
  return mocks.calls.filter((c) => c.op === "select" && c.filters.some((f) => f.kind === "order")).at(-1)!;
}

beforeEach(() => {
  mocks.session = { user: { id: USER_ID } };
  mocks.calls = [];
  mocks.activeRows = [];
});

describe("GET /api/toolbox/power-analysis/jobs/active", () => {
  it("requires login", async () => {
    mocks.session = null;
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns null when nothing is queued or analyzing", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ job: null });
  });

  it("returns the caller's newest queued or processing job with its settings", async () => {
    mocks.activeRows = [activeJob("processing")];
    const res = await GET();
    const body = await res.json();

    expect(body.data.job).toMatchObject({
      id: "job-1",
      status: "processing",
      mode: "back_squat",
      externalLoadKg: 100,
      plateDiameterCm: 45,
    });
    const query = lastListQuery();
    expect(query.filters).toContainEqual({ kind: "eq", args: ["user_id", USER_ID] });
    expect(query.filters).toContainEqual({ kind: "in", args: ["status", ["queued", "processing"]] });
    expect(query.filters).toContainEqual({ kind: "order", args: ["created_at", { ascending: false }] });
  });
});
