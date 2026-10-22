import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, writes, sendSystemMessage, state } = vi.hoisted(() => {
    const writes: Array<{ table: string; op: string; payload?: unknown; filter?: [string, unknown] }> = [];
    const state = { existingCoach: null as Record<string, unknown> | null };
    const sendSystemMessage = vi.fn(async () => true);

    const db = {
        from(table: string) {
            let op = "select";
            let payload: unknown;
            const chain: any = {
                select: () => chain,
                insert: (value: unknown) => {
                    op = "insert";
                    payload = value;
                    writes.push({ table, op, payload });
                    return Promise.resolve({ error: null });
                },
                update: (value: unknown) => {
                    op = "update";
                    payload = value;
                    return chain;
                },
                eq: (column: string, value: unknown) => {
                    if (op === "update") {
                        writes.push({ table, op, payload, filter: [column, value] });
                        return Promise.resolve({ error: null });
                    }
                    return chain;
                },
                maybeSingle: async () => ({ data: state.existingCoach, error: null }),
            };
            return chain;
        },
    };
    return { db, writes, sendSystemMessage, state };
});

vi.mock("./supabaseClient", () => ({ default: db, serviceRoleSupabase: db }));
vi.mock("./chat", () => ({ sendSystemMessage }));

import { applyCoachReviewSideEffects, isCoachReviewStatus } from "./coachApplicationReview";

const application = {
    id: "app-1",
    user_id: "user-1",
    name: "赵上",
    coach_track: "growth",
    contact_phone: "13800000000",
    service_modes: ["hybrid"],
};

describe("applyCoachReviewSideEffects", () => {
    beforeEach(() => {
        writes.length = 0;
        state.existingCoach = null;
        sendSystemMessage.mockClear();
    });

    it("creates the coach, unlocks the coach side and sends the welcome message", async () => {
        const result = await applyCoachReviewSideEffects({ status: "approved", existingApplication: application });

        expect(result).toEqual({ ok: true });
        const coachInsert = writes.find((w) => w.table === "coaches" && w.op === "insert");
        expect(coachInsert?.payload).toMatchObject({ user_id: "user-1", name: "赵上", coach_track: "growth", status: "approved" });
        expect(writes).toContainEqual({
            table: "users",
            op: "update",
            payload: { is_coach: true, coach_status: "approved" },
            filter: ["id", "user-1"],
        });
        expect(sendSystemMessage).toHaveBeenCalledWith("user-1", { content: expect.stringContaining("开店 4 步") });
    });

    it("updates an existing coach row instead of inserting a duplicate", async () => {
        state.existingCoach = { id: "coach-1", user_id: "user-1" };
        await applyCoachReviewSideEffects({ status: "approved", existingApplication: application });

        expect(writes.some((w) => w.table === "coaches" && w.op === "insert")).toBe(false);
        expect(writes.find((w) => w.table === "coaches" && w.op === "update")?.filter).toEqual(["id", "coach-1"]);
    });

    it("asks for more material with the reviewer's notes", async () => {
        await applyCoachReviewSideEffects({
            status: "needs_info",
            existingApplication: application,
            reviewNotes: "请补充训练经历",
        });

        expect(writes).toContainEqual({
            table: "users",
            op: "update",
            payload: { is_coach: false, coach_status: "pending" },
            filter: ["id", "user-1"],
        });
        expect(sendSystemMessage).toHaveBeenCalledWith("user-1", { content: expect.stringContaining("请补充训练经历") });
    });

    it("can close an application without messaging the applicant", async () => {
        await applyCoachReviewSideEffects({
            status: "rejected",
            existingApplication: application,
            reviewNotes: "测试账号清理",
            notifyApplicant: false,
        });

        expect(writes).toContainEqual({
            table: "users",
            op: "update",
            payload: { is_coach: false, coach_status: "rejected" },
            filter: ["id", "user-1"],
        });
        expect(sendSystemMessage).not.toHaveBeenCalled();
    });

    it("does not message anyone when moving to reviewing", async () => {
        await applyCoachReviewSideEffects({ status: "reviewing", existingApplication: application });
        expect(sendSystemMessage).not.toHaveBeenCalled();
    });
});

describe("isCoachReviewStatus", () => {
    it("accepts only review outcomes", () => {
        expect(isCoachReviewStatus("needs_info")).toBe(true);
        expect(isCoachReviewStatus("pending")).toBe(false);
        expect(isCoachReviewStatus(undefined)).toBe(false);
    });
});
