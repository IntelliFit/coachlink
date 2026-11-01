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

function sets(planCount: number, extraCount: number) {
    return Array.from({ length: planCount + extraCount }, (_, index) => ({
        set_number: index + 1,
        set_index: index,
        completed: false,
        ...(index >= planCount ? { source: "student_extra" } : {}),
    }));
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

// 内存版 impromptu_execution_set_videos，和线上一样强制唯一约束和 set_number >= 1。
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
                if (next.set_number < 1) return { error: { message: "violates check constraint" } };
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

async function deleteSet(actionIndex: number, setIndex: number) {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/impromptu/extra-content/delete-extra-set", {
        method: "POST",
        body: JSON.stringify({ executionId: EXECUTION_ID, actionIndex, setIndex }),
    }) as any);
    return { status: response.status, body: await response.json() };
}

function setNumbersById() {
    return Object.fromEntries(videos.map((row) => [row.id, row.set_number]));
}

function attachedVideos() {
    const merged: any = mergeImpromptuSetVideos(execution, videos);
    return merged.action_executions.flatMap((item: any) =>
        item.sets.filter((set: any) => set.video_id).map((set: any) => [item.action_name, set.set_number, set.video_id])
    );
}

describe("delete impromptu extra set keeps set videos aligned", () => {
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
                { action_name: "squat", sets: sets(2, 3) },
                { action_name: "bench", sets: sets(2, 2) },
            ],
        };
        // 故意把后面组排在前面：直接写目标值时 extra-5 会撞上 extra-4。
        videos = [
            video("squat-1", 0, 1),
            video("extra-3", 0, 3),
            video("extra-5", 0, 5, { storage_path: "external/extra-5", file_size_bytes: 0 }),
            video("extra-4", 0, 4),
            video("bench-3", 1, 3),
            video("bench-4", 1, 4),
        ];
        executionUpdates = [];
        videoWrites = 0;
        failVideoRead = false;
        failVideoDelete = false;
        failExecutionUpdate = false;
        failVideoWriteAt = null;
    });

    it("removes the deleted set's row and shifts later rows of the same action", async () => {
        const result = await deleteSet(0, 2);

        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
        expect(setNumbersById()).toEqual({
            "squat-1": 1,
            "extra-4": 3,
            "extra-5": 4,
            "bench-3": 3,
            "bench-4": 4,
        });
    });

    it("attaches each remaining video to the same set as before the delete", async () => {
        await deleteSet(0, 2);

        expect(execution.action_executions[0].sets.map((set: any) => set.set_number)).toEqual([1, 2, 3, 4]);
        expect(attachedVideos()).toEqual([
            ["squat", 1, "squat-1"],
            ["squat", 3, "extra-4"],
            ["squat", 4, "extra-5"],
            ["bench", 3, "bench-3"],
            ["bench", 4, "bench-4"],
        ]);
    });

    it("frees only the deleted set's file and bytes, after the list is saved", async () => {
        mocks.cosRemove.mockImplementation(async () => {
            expect(executionUpdates).toHaveLength(1);
        });

        await deleteSet(0, 2);

        expect(mocks.cosRemove).toHaveBeenCalledTimes(1);
        expect(mocks.cosRemove).toHaveBeenCalledWith("videos", ["impromptu/extra-3.mp4"]);
        expect(mocks.incrementStorageUsage).toHaveBeenCalledTimes(1);
        expect(mocks.incrementStorageUsage).toHaveBeenCalledWith(USER_ID, -MB);
    });

    it("does not call COS or change usage for an external link", async () => {
        await deleteSet(0, 4);

        expect(videos.map((row) => row.id)).not.toContain("extra-5");
        expect(mocks.cosRemove).not.toHaveBeenCalled();
        expect(mocks.incrementStorageUsage).not.toHaveBeenCalled();
    });

    it("does not write video rows or touch storage when no video needs to change", async () => {
        videos = [video("squat-1", 0, 1), video("bench-3", 1, 3)];

        const result = await deleteSet(0, 4);

        expect(result.status).toBe(200);
        expect(videoWrites).toBe(0);
        expect(mocks.cosRemove).not.toHaveBeenCalled();
        expect(mocks.incrementStorageUsage).not.toHaveBeenCalled();
    });

    it("restores every row and keeps the files when saving the list fails", async () => {
        const before = setNumbersById();
        failExecutionUpdate = true;

        const result = await deleteSet(0, 2);

        expect(result.status).toBe(500);
        expect(setNumbersById()).toEqual(before);
        expect(mocks.cosRemove).not.toHaveBeenCalled();
        expect(mocks.incrementStorageUsage).not.toHaveBeenCalled();
    });

    // 共 3 行要动：第 1-3 次写在临时区间，第 4-6 次写目标值。
    it.each([2, 5])("restores every row and keeps the set when video write %i fails", async (failAt) => {
        const before = setNumbersById();
        failVideoWriteAt = failAt;

        const result = await deleteSet(0, 2);

        expect(result.status).toBe(500);
        expect(setNumbersById()).toEqual(before);
        expect(executionUpdates).toEqual([]);
        expect(mocks.cosRemove).not.toHaveBeenCalled();
        expect(mocks.incrementStorageUsage).not.toHaveBeenCalled();
    });

    it("refuses the delete when the video rows cannot be read", async () => {
        const before = setNumbersById();
        failVideoRead = true;

        const result = await deleteSet(0, 2);

        expect(result.status).toBe(500);
        expect(setNumbersById()).toEqual(before);
        expect(executionUpdates).toEqual([]);
    });

    it("still succeeds when removing the row fails after the list is saved, and clears it on the next delete", async () => {
        failVideoDelete = true;
        const first = await deleteSet(0, 2);

        expect(first.status).toBe(200);
        expect(attachedVideos()).toEqual([
            ["squat", 1, "squat-1"],
            ["squat", 3, "extra-4"],
            ["squat", 4, "extra-5"],
            ["bench", 3, "bench-3"],
            ["bench", 4, "bench-4"],
        ]);
        expect(mocks.cosRemove).not.toHaveBeenCalled();
        expect(mocks.incrementStorageUsage).not.toHaveBeenCalled();

        failVideoDelete = false;
        // 残留行还占着停放位，不先清掉，这次要停放的 extra-4 就会撞唯一约束。
        const second = await deleteSet(0, 2);

        expect(second.status).toBe(200);
        expect(setNumbersById()).toEqual({
            "squat-1": 1,
            "extra-5": 3,
            "bench-3": 3,
            "bench-4": 4,
        });
        expect(mocks.cosRemove.mock.calls.flatMap((call) => call[1])).toEqual([
            "impromptu/extra-3.mp4",
            "impromptu/extra-4.mp4",
        ]);
    });

    it("does not touch videos when the set is not the student's own", async () => {
        const before = setNumbersById();

        const result = await deleteSet(0, 0);

        expect(result.status).toBe(403);
        expect(setNumbersById()).toEqual(before);
        expect(videoWrites).toBe(0);
    });
});
