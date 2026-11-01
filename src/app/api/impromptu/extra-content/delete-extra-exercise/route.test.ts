import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeImpromptuSetVideos } from "@/lib/impromptuSetVideos";

type VideoRow = {
    id: string;
    execution_id: string;
    action_index: number;
    set_number: number;
    video_url: string;
    storage_path: string;
    file_size_bytes: number;
};

const mocks = vi.hoisted(() => ({
    from: vi.fn(),
    getApiUserId: vi.fn(),
    cosRemove: vi.fn(),
    incrementStorageUsage: vi.fn(),
}));

vi.mock("@/lib/getApiUserId", () => ({ getApiUserId: mocks.getApiUserId }));
vi.mock("@/lib/supabaseClient", () => ({
    default: { from: mocks.from },
    serviceRoleSupabase: { from: mocks.from },
}));
vi.mock("@/lib/cos", () => ({ cosRemove: mocks.cosRemove }));
vi.mock("@/lib/membershipLimit", () => ({
    checkStorageAvailable: vi.fn(),
    incrementStorageUsage: mocks.incrementStorageUsage,
}));

const EXECUTION_ID = "execution-1";
const USER_ID = "student-1";
const MB = 1024 * 1024;

let execution: Record<string, any>;
let videos: VideoRow[];
let executionUpdates: Record<string, any>[];
let videoWrites: number;
let failVideoRead: boolean;
let failVideoDelete: boolean;
let failExecutionUpdate: boolean;
let failVideoWriteAt: number | null;

function action(name: string, source?: string) {
    return {
        action_name: name,
        source,
        sets: [
            { set_number: 1, completed: false },
            { set_number: 2, completed: false },
        ],
    };
}

function video(id: string, actionIndex: number, setNumber: number, overrides: Partial<VideoRow> = {}): VideoRow {
    return {
        id,
        execution_id: EXECUTION_ID,
        action_index: actionIndex,
        set_number: setNumber,
        video_url: `https://cdn.test/${id}.mp4`,
        storage_path: `impromptu/${id}.mp4`,
        file_size_bytes: MB,
        ...overrides,
    };
}

// 内存版 impromptu_execution_set_videos，和线上一样强制 (execution_id, action_index, set_number) 唯一。
function videoTable() {
    return {
        select: () => ({
            eq: async () => failVideoRead
                ? { data: null, error: { message: "read failed" } }
                : { data: videos.map((row) => ({ ...row })), error: null },
        }),
        update: (patch: Partial<VideoRow>) => ({
            eq: async (_column: string, id: string) => {
                videoWrites += 1;
                if (failVideoWriteAt === videoWrites) return { error: { message: "write failed" } };
                const target = videos.find((row) => row.id === id)!;
                const next = { ...target, ...patch };
                const collision = videos.some((row) =>
                    row.id !== id &&
                    row.execution_id === next.execution_id &&
                    row.action_index === next.action_index &&
                    row.set_number === next.set_number
                );
                if (collision) return { error: { message: "duplicate key value violates unique constraint" } };
                videos = videos.map((row) => (row.id === id ? next : row));
                return { error: null };
            },
        }),
        delete: () => ({
            in: async (_column: string, ids: string[]) => {
                if (failVideoDelete) return { error: { message: "delete failed" } };
                videos = videos.filter((row) => !ids.includes(row.id));
                return { error: null };
            },
        }),
    };
}

function executionTable() {
    return {
        select: () => ({
            eq: () => ({ single: async () => ({ data: execution, error: null }) }),
        }),
        update: (patch: Record<string, any>) => ({
            eq: () => ({
                eq: async () => {
                    if (failExecutionUpdate) return { error: { message: "update failed" } };
                    executionUpdates.push(patch);
                    execution = { ...execution, ...patch };
                    return { error: null };
                },
            }),
        }),
    };
}

async function deleteAction(actionIndex: number) {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/impromptu/extra-content/delete-extra-exercise", {
        method: "POST",
        body: JSON.stringify({ executionId: EXECUTION_ID, actionIndex }),
    }) as any);
    return { status: response.status, body: await response.json() };
}

function indexesById() {
    return Object.fromEntries(videos.map((row) => [row.id, row.action_index]));
}

describe("delete impromptu extra exercise keeps set videos aligned", () => {
    beforeEach(() => {
        mocks.getApiUserId.mockReset().mockResolvedValue(USER_ID);
        mocks.cosRemove.mockReset().mockResolvedValue(undefined);
        mocks.incrementStorageUsage.mockReset().mockResolvedValue(undefined);
        mocks.from.mockReset().mockImplementation((table: string) => {
            if (table === "impromptu_executions") return executionTable();
            if (table === "impromptu_execution_set_videos") return videoTable();
            throw new Error(`unexpected table ${table}`);
        });
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        execution = {
            id: EXECUTION_ID,
            student_id: USER_ID,
            status: "in_progress",
            action_executions: [
                action("squat"),
                action("curl", "student_extra"),
                action("bench"),
                action("row", "student_extra"),
            ],
        };
        videos = [
            video("squat-1", 0, 1),
            video("curl-1", 1, 1),
            video("curl-2", 1, 2, { storage_path: "external/curl-2", file_size_bytes: 0 }),
            video("bench-1", 2, 1),
            video("row-2", 3, 2),
        ];
        executionUpdates = [];
        videoWrites = 0;
        failVideoRead = false;
        failVideoDelete = false;
        failExecutionUpdate = false;
        failVideoWriteAt = null;
    });

    it("removes the deleted action's rows and shifts later rows onto their new index", async () => {
        const result = await deleteAction(1);

        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
        expect(indexesById()).toEqual({ "squat-1": 0, "bench-1": 1, "row-2": 2 });
    });

    it("attaches each remaining video to the same action as before the delete", async () => {
        await deleteAction(1);

        const merged: any = mergeImpromptuSetVideos(execution, videos);
        const attached = merged.action_executions.flatMap((item: any) =>
            item.sets.filter((set: any) => set.video_id).map((set: any) => [item.action_name, set.set_number, set.video_id])
        );
        expect(attached).toEqual([
            ["squat", 1, "squat-1"],
            ["bench", 1, "bench-1"],
            ["row", 2, "row-2"],
        ]);
    });

    it("frees managed storage only, and counts only the deleted action's bytes", async () => {
        await deleteAction(1);

        expect(mocks.cosRemove).toHaveBeenCalledTimes(1);
        expect(mocks.cosRemove).toHaveBeenCalledWith("videos", ["impromptu/curl-1.mp4"]);
        expect(mocks.incrementStorageUsage).toHaveBeenCalledTimes(1);
        expect(mocks.incrementStorageUsage).toHaveBeenCalledWith(USER_ID, -MB);
    });

    it("leaves earlier rows alone when the last action is deleted", async () => {
        await deleteAction(3);

        expect(indexesById()).toEqual({ "squat-1": 0, "curl-1": 1, "curl-2": 1, "bench-1": 2 });
        expect(mocks.cosRemove).toHaveBeenCalledWith("videos", ["impromptu/row-2.mp4"]);
    });

    it("does not write video rows or touch storage when no video needs to change", async () => {
        videos = [video("squat-1", 0, 1)];

        const result = await deleteAction(3);

        expect(result.status).toBe(200);
        expect(videoWrites).toBe(0);
        expect(mocks.cosRemove).not.toHaveBeenCalled();
        expect(mocks.incrementStorageUsage).not.toHaveBeenCalled();
    });

    it("restores every row and keeps the files when saving the action list fails", async () => {
        const before = indexesById();
        failExecutionUpdate = true;

        const result = await deleteAction(1);

        expect(result.status).toBe(500);
        expect(indexesById()).toEqual(before);
        expect(mocks.cosRemove).not.toHaveBeenCalled();
        expect(mocks.incrementStorageUsage).not.toHaveBeenCalled();
    });

    it("restores every row and keeps the action when moving a video fails midway", async () => {
        const before = indexesById();
        failVideoWriteAt = 3;

        const result = await deleteAction(1);

        expect(result.status).toBe(500);
        expect(indexesById()).toEqual(before);
        expect(executionUpdates).toEqual([]);
        expect(mocks.cosRemove).not.toHaveBeenCalled();
    });

    it("refuses the delete when the video rows cannot be read", async () => {
        const before = indexesById();
        failVideoRead = true;

        const result = await deleteAction(1);

        expect(result.status).toBe(500);
        expect(indexesById()).toEqual(before);
        expect(executionUpdates).toEqual([]);
    });

    it("still succeeds when removing the rows fails after the action list is saved, and clears them on the next delete", async () => {
        failVideoDelete = true;
        const first = await deleteAction(1);

        expect(first.status).toBe(200);
        expect(execution.action_executions.map((item: any) => item.action_name)).toEqual(["squat", "bench", "row"]);
        const merged: any = mergeImpromptuSetVideos(execution, videos);
        expect(merged.action_executions.flatMap((item: any) => item.sets)
            .filter((set: any) => set.video_id)
            .map((set: any) => set.video_id)).toEqual(["squat-1", "bench-1", "row-2"]);
        expect(mocks.cosRemove).not.toHaveBeenCalled();

        failVideoDelete = false;
        // row 的第 2 组与残留的 curl-2 组号相同，不先清掉残留就会撞唯一约束。
        const second = await deleteAction(2);

        expect(second.status).toBe(200);
        expect(indexesById()).toEqual({ "squat-1": 0, "bench-1": 1 });
    });

    it("does not touch videos when the action is not the student's own", async () => {
        const before = indexesById();

        const result = await deleteAction(0);

        expect(result.status).toBe(403);
        expect(indexesById()).toEqual(before);
        expect(videoWrites).toBe(0);
    });
});
