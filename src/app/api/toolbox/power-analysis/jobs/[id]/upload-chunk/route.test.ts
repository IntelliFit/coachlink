import { writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const CHUNK_BYTES = 4 * 1024 * 1024;

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  calls: [] as SupabaseExecContext[],
  row: null as any,
  // Bytes each chunk holds in temporary storage; a missing key fails the download.
  storedChunks: new Map<string, Buffer>(),
  uploadedChunks: [] as string[],
  // The final video object: null until something writes it.
  stored: null as { size: number } | null,
  uploadOptions: [] as Array<Record<string, unknown>>,
  removed: [] as string[][],
  // Overrides the size the object store reports back after a write.
  reportedSize: null as number | null,
}));

function filterValue(ctx: SupabaseExecContext, column: string) {
  return ctx.filters.find((f) => f.kind === "eq" && f.args[0] === column)?.args[1];
}

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
  getServerSession: async () => mocks.session,
}));

vi.mock("@/lib/cos", () => ({
  cosUpload: async (_bucket: string, key: string, data: Buffer) => {
    mocks.uploadedChunks.push(key);
    mocks.storedChunks.set(key, data);
  },
  cosDownloadFile: async (_bucket: string, key: string, path: string) => {
    const data = mocks.storedChunks.get(key);
    if (!data) throw new Error("no such key");
    await writeFile(path, data);
  },
  cosRemove: async () => undefined,
}));

vi.mock("@/lib/supabaseClient", () => {
  const client: any = createMockSupabase((ctx) => {
    mocks.calls.push(ctx);
    if (ctx.op === "select") {
      const owned = filterValue(ctx, "id") === mocks.row?.id;
      return { data: owned ? { ...mocks.row } : null, error: null };
    }
    if (ctx.op === "update") {
      const expected = filterValue(ctx, "updated_at");
      if (expected && expected !== mocks.row.updated_at) return { data: null, error: null };
      mocks.row = { ...mocks.row, ...ctx.payload };
      return { data: { ...mocks.row }, error: null };
    }
    return { data: null, error: null };
  });
  client.storage = {
    from: () => ({
      upload: async (_path: string, blob: Blob, options: Record<string, unknown>) => {
        mocks.uploadOptions.push(options);
        if (mocks.stored && !options.upsert) {
          return { data: null, error: { message: "The resource already exists" } };
        }
        mocks.stored = { size: blob.size };
        return { data: {}, error: null };
      },
      info: async () => ({
        data: { size: mocks.reportedSize ?? mocks.stored?.size ?? -1 },
        error: null,
      }),
      remove: async (paths: string[]) => {
        mocks.removed.push(paths);
        mocks.stored = null;
        return { data: null, error: null };
      },
    }),
  };
  return { default: client, serviceRoleSupabase: client };
});

import { POST } from "./route";

const USER_ID = "user-1";
const JOB_ID = "job-1";
const UPLOAD_ID = "power_upload_1";
const ROUTE = `http://localhost/api/toolbox/power-analysis/jobs/${JOB_ID}/upload-chunk`;

function job(fileSize: number, extra: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    user_id: USER_ID,
    mode: "pullup",
    height_cm: 180,
    weight_kg: 70,
    status: "awaiting_upload",
    progress: 0,
    input_storage_bucket: "videos",
    input_storage_path: "toolbox/power-analysis/tmp/user-1/job-1/input.mp4",
    output_storage_path: null,
    original_file_size_bytes: fileSize,
    metadata: { max_video_size_mb: 100, client_events: [{ event: "left_during_upload" }] },
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: "2026-11-01T00:00:00.000Z",
    ...extra,
  };
}

function call(url: string, init: RequestInit) {
  return POST(new Request(url, { method: "POST", ...init }), { params: Promise.resolve({ id: JOB_ID }) });
}

function sendChunk(chunkIndex: number, totalChunks: number, totalSize: number, chunkSize: number, bodySize = chunkSize) {
  const query = new URLSearchParams({
    action: "chunk",
    uploadId: UPLOAD_ID,
    chunkIndex: String(chunkIndex),
    chunkSize: String(chunkSize),
    totalChunks: String(totalChunks),
    totalSize: String(totalSize),
  });
  return call(`${ROUTE}?${query}`, { body: new Uint8Array(bodySize) });
}

function complete(totalSize: number, totalChunks: number, uploadId = UPLOAD_ID) {
  return call(`${ROUTE}?action=complete`, {
    body: JSON.stringify({ uploadId, totalSize, totalChunks, contentType: "video/mp4" }),
  });
}

function seedChunks(size: number) {
  const key = `_tmp/power-analysis-chunks/${USER_ID}/${JOB_ID}/${UPLOAD_ID}/0.part`;
  mocks.storedChunks.set(key, Buffer.alloc(size));
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.session = { user: { id: USER_ID } };
  mocks.calls = [];
  mocks.row = job(1000);
  mocks.storedChunks = new Map();
  mocks.uploadedChunks = [];
  mocks.stored = null;
  mocks.uploadOptions = [];
  mocks.removed = [];
  mocks.reportedSize = null;
});

describe("POST upload-chunk: receiving a chunk", () => {
  it("accepts a chunk of exactly the expected size", async () => {
    mocks.row = job(CHUNK_BYTES + 10);
    const response = await sendChunk(0, 2, CHUNK_BYTES + 10, CHUNK_BYTES);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data).toEqual({ chunkIndex: 0, receivedSize: CHUNK_BYTES });
    expect(mocks.uploadedChunks).toHaveLength(1);
  });

  it("rejects a short chunk without storing it", async () => {
    mocks.row = job(1000);
    const response = await sendChunk(0, 1, 1000, 1000, 600);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.message).toBe("第 1 个视频分片传输不完整，请重试");
    expect(mocks.uploadedChunks).toHaveLength(0);
  });

  // Pod logs die with every rollout, which is why the real shortfalls of the October
  // failures could no longer be read. Keep the numbers on the job.
  it("records how many bytes arrived on the job, keeping client events", async () => {
    mocks.row = job(1000);
    await sendChunk(0, 1, 1000, 1000, 600);
    expect(mocks.row.metadata.upload_failure_stage).toBe("chunk_receive");
    expect(mocks.row.metadata.upload_failure_details).toMatchObject({
      chunkIndex: 0,
      expectedChunkBytes: 1000,
      receivedChunkSize: 600,
    });
    expect(mocks.row.metadata.client_events).toEqual([{ event: "left_during_upload" }]);
    // A retry can still succeed, so this must not read as the job's final error.
    expect(mocks.row.error_message).toBeUndefined();
  });

  it("does not overwrite metadata that changed while the chunk was arriving", async () => {
    mocks.row = job(1000);
    await sendChunk(0, 1, 1000, 1000, 600);
    const update = mocks.calls.find((c) => c.op === "update");
    expect(filterValue(update!, "updated_at")).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("POST upload-chunk: complete", () => {
  it("stores the merged video and marks the job uploaded", async () => {
    mocks.row = job(1000);
    seedChunks(1000);
    const response = await complete(1000, 1);
    expect(response.status).toBe(200);
    expect(mocks.stored).toEqual({ size: 1000 });
    expect(mocks.row.metadata.uploaded_size_bytes).toBe(1000);
  });

  // Job 95222e72: the client gave up on a slow complete at 30s and uploaded again. The
  // second complete hit "The resource already exists", and its error path deleted the
  // video the first complete had just stored.
  it("succeeds when a retried complete finds the video already stored", async () => {
    mocks.row = job(1000);
    mocks.stored = { size: 1000 };
    seedChunks(1000);
    const response = await complete(1000, 1);
    expect(response.status).toBe(200);
    expect(mocks.removed).toEqual([]);
    expect(mocks.stored).toEqual({ size: 1000 });
  });

  it("keeps a stored video when a later complete fails before writing", async () => {
    mocks.row = job(1000);
    mocks.stored = { size: 1000 };
    const response = await complete(1000, 1, "power_upload_2");
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.message).toBe("第 1 个视频分片缺失");
    expect(mocks.removed).toEqual([]);
    expect(mocks.stored).toEqual({ size: 1000 });
  });

  it("removes the object when the store reports the wrong size", async () => {
    mocks.row = job(1000);
    mocks.reportedSize = 999;
    seedChunks(1000);
    const response = await complete(1000, 1);
    expect(response.status).toBe(500);
    expect(mocks.removed).toHaveLength(1);
  });

  it("does not touch a job that already left awaiting_upload", async () => {
    mocks.row = job(1000, { status: "queued" });
    seedChunks(1000);
    const response = await complete(1000, 1);
    expect(response.status).toBe(409);
    expect(mocks.stored).toBeNull();
  });
});
