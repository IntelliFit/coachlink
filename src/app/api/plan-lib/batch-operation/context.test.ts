import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/student/get-current-1rm/route", () => ({
    getCurrent1RMRecords: vi.fn(async () => [
        { actionName: "杠铃深蹲", current1RM: 140, isAutoCalculated: false, lastUpdated: "2026-10-01" },
    ]),
}));

import { buildBatchOperationContext } from "./context";

const COACH_USER = "coach-user";
const COACH_ROW = "coach-row";
const STUDENT = "student-1";
const BENCH_ACTION_ID = "6f1c2d3e-4a5b-4c6d-8e7f-901234567890";

type Row = Record<string, any>;

/** 只实现 context.ts 用到的查询方法；记录每次读了哪张表。 */
function createFakeSupabase(tables: Record<string, Row[]>) {
    const reads: string[] = [];
    const from = (table: string) => {
        reads.push(table);
        const filters: Array<(row: Row) => boolean> = [];
        let limit: number | null = null;
        let single = false;
        const builder: any = {
            select: () => builder,
            order: () => builder,
            eq: (column: string, value: unknown) => {
                filters.push((row) => row[column] === value);
                return builder;
            },
            in: (column: string, values: unknown[]) => {
                filters.push((row) => values.includes(row[column]));
                return builder;
            },
            limit: (n: number) => {
                limit = n;
                return builder;
            },
            maybeSingle: () => {
                single = true;
                return builder;
            },
            then: (resolve: any, reject: any) => {
                let rows = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)));
                if (limit !== null) rows = rows.slice(0, limit);
                return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
            },
        };
        return builder;
    };
    return { client: { from } as any, reads };
}

const baseTables = (subscriptionStatus: string): Record<string, Row[]> => ({
    coaches: [{ id: COACH_ROW, user_id: COACH_USER }],
    coach_subscriptions: [{
        id: "sub-1",
        student_id: STUDENT,
        coach_id: COACH_ROW,
        status: subscriptionStatus,
        subscribe_data: [
            { type: "rm", question: "主项 1RM", userInputs: { [BENCH_ACTION_ID]: 100 } },
            { type: "text", question: "是否有伤病", userSelection: "左膝术后" },
        ],
    }],
    coach_actions: [{ id: BENCH_ACTION_ID, name: "杠铃卧推", coach_id: COACH_USER, type: "STRENGTH" }],
    user_profiles: [{ user_id: STUDENT, weight: 72, gender: "male", fitness_goal: "力量" }],
    coach_plan_instances: [
        { id: "inst-current", student_id: STUDENT, coach_subscription_id: "sub-1", status: "active" },
        { id: "inst-other-coach", student_id: STUDENT, coach_subscription_id: "sub-old", status: "active" },
    ],
    execution_feedbacks: [
        { instance_id: "inst-current", student_id: STUDENT, day_index: 3, difficulty_rating: 5, content: "深蹲太重" },
        { instance_id: "inst-other-coach", student_id: STUDENT, day_index: 2, difficulty_rating: 1, content: "别的教练的计划" },
    ],
    plan_instance_executions: [],
    onboarding_questionnaires: [],
    student_actions: [],
    community_actions: [],
    coach_plan_templates: [],
});

const options = {
    subscriptionId: "sub-1",
    subjectUserId: STUDENT,
    includeStudentProfile: true,
    includeStudentQuestionnaire: true,
    includeExecutionHistory: true,
    includeFeedbacks: true,
    includeCoachActionLib: false,
    includePublicActionLib: false,
    includeCoachTemplates: false,
    includeTemplateMatch: false,
};

describe("buildBatchOperationContext (item 4)", () => {
    it("puts name → 1RM, body weight and injuries first, with questionnaire lifts by name", async () => {
        const { client } = createFakeSupabase(baseTables("active"));
        const result = await buildBatchOperationContext({
            userId: COACH_USER,
            targetActionType: "coach",
            contextOptions: { ...options, lockedThroughDayIndex: 7 },
            supabase: client,
        });

        const factsAt = result.prompt.indexOf("## 学员关键数据");
        expect(factsAt).toBeGreaterThan(-1);
        expect(factsAt).toBeLessThan(result.prompt.indexOf("## 购买计划问卷"));
        expect(result.prompt).toContain("体重: 72kg");
        expect(result.prompt).toContain("杠铃深蹲 = 140kg");
        expect(result.prompt).toContain("杠铃卧推 = 100kg（购买问卷）");
        expect(result.prompt).not.toContain(BENCH_ACTION_ID);
        expect(result.prompt).toContain("左膝术后");
        expect(result.prompt).toContain("第1–7天");
        expect(result.enabled).toContain("学员1RM与体重");
    });

    it("reads feedback only from the current subscription's plan, quoted", async () => {
        const { client } = createFakeSupabase(baseTables("active"));
        const result = await buildBatchOperationContext({
            userId: COACH_USER,
            targetActionType: "coach",
            contextOptions: options,
            supabase: client,
        });
        expect(result.prompt).toContain("学员原话: \"深蹲太重\"");
        expect(result.prompt).not.toContain("别的教练的计划");
        expect(result.compactPrompt).toContain("深蹲太重");
        expect(result.compactPrompt).toContain("杠铃深蹲 = 140kg");
    });

    it("gives a former coach nothing about the student", async () => {
        const { client, reads } = createFakeSupabase(baseTables("cancelled"));
        const result = await buildBatchOperationContext({
            userId: COACH_USER,
            targetActionType: "coach",
            contextOptions: options,
            supabase: client,
        });
        expect(result.prompt).not.toContain("杠铃深蹲 = 140kg");
        expect(result.prompt).not.toContain("深蹲太重");
        expect(result.unavailable).toEqual(expect.arrayContaining(["学员基本情况", "学员反馈", "执行记录"]));
        expect(reads).not.toContain("user_profiles");
        expect(reads).not.toContain("execution_feedbacks");
    });

    it("does not trust a hinted student without a live subscription to this coach", async () => {
        const tables = baseTables("active");
        tables.coach_subscriptions[0].coach_id = "someone-else";
        const { client, reads } = createFakeSupabase(tables);
        const result = await buildBatchOperationContext({
            userId: COACH_USER,
            targetActionType: "coach",
            contextOptions: { ...options, subscriptionId: undefined },
            supabase: client,
        });
        expect(result.prompt).not.toContain("目标学员 user_id");
        expect(reads).not.toContain("user_profiles");
    });
});
