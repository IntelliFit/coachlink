import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const COACH_USER = "coach-user-1";
const COACH_ID = "coach-1";

const mocks = vi.hoisted(() => ({
    store: {} as Record<string, any>,
    matchPlan: vi.fn(),
    findClosestPlans: vi.fn(),
    fillTemplate: vi.fn(),
    generatePersonalizedPlan: vi.fn(),
    archive: vi.fn(),
    sendDirectMessage: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => {
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        const s = mocks.store;
        if (ctx.table === "coach_subscriptions") return { data: s.subscription, error: null };
        if (ctx.table === "coach_plan_instances") {
            if (ctx.op === "insert") {
                s.inserted = { id: "plan-new", ...ctx.payload };
                return { data: s.inserted, error: null };
            }
            const statuses = ctx.filters.find((f) => f.kind === "in" && f.args[0] === "status")?.args[1] as string[] | undefined;
            const rows = (s.plans as any[]).filter((plan) => !statuses || statuses.includes(plan.status));
            const single = ctx.filters.some((f) => f.kind === "maybeSingle" || f.kind === "single");
            return { data: single ? rows[0] || null : rows, error: null };
        }
        if (ctx.table === "user_profiles") return { data: { nickname: "小王", weight: 70 }, error: null };
        return { data: [], error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("./match", () => ({
    matchPlan: mocks.matchPlan,
    findClosestPlans: mocks.findClosestPlans,
    fillTemplate: mocks.fillTemplate,
}));
vi.mock("../ai-personalize-plan/service", () => ({
    AiPersonalizeError: class AiPersonalizeError extends Error {},
    buildActionLibrary: () => [],
    buildPRRecordSummaries: () => [],
    buildTemplateSummary: (tpl: any) => ({ id: tpl.id, dayCount: (tpl.training_days || []).length }),
    generatePersonalizedPlan: mocks.generatePersonalizedPlan,
}));
vi.mock("@/app/api/student/get-current-1rm/route", () => ({ getCurrent1RMRecords: async () => [] }));
vi.mock("@/lib/chat", () => ({ sendDirectMessage: mocks.sendDirectMessage }));
vi.mock("@/lib/subscriptionCarryover", () => ({ getSubscriptionCarryoverSummary: async () => ({ exhausted: false }) }));
vi.mock("@/lib/subscriptionEntitlement", () => ({ archiveCurrentPlanInstancesForSubscription: mocks.archive }));
vi.mock("../sync-actions", () => ({ syncCoachActionsToStudentLibrary: vi.fn() }));

import { ApiError, createAiInstanceForSubscription, PlanAlreadyExistsError } from "./service";

const template = (id: string, extra: Record<string, any> = {}) => ({
    id,
    name: `模板 ${id}`,
    description: "模板描述",
    tags: ["深蹲"],
    week_days: [3],
    training_days: [
        { type: "training", dayIndex: 1, actionSets: [{ type: "no-filter", actionId: "act-1", params: {} }] },
        { type: "rest", dayIndex: 2, actionSets: [] },
    ],
    ...extra,
});

const params = (extra: Record<string, any> = {}) => ({
    actorUserId: COACH_USER,
    actorCoachId: COACH_ID,
    subscriptionId: "sub-1",
    useLLM: true,
    ...extra,
});

beforeEach(() => {
    vi.clearAllMocks();
    mocks.store = {
        subscription: {
            id: "sub-1",
            coach_id: COACH_ID,
            student_id: "student-1",
            status: "active",
            subscribed_weeks: 4,
            subscribe_data: [{ type: "option", question: "每周训练次数", options: ["2次", "3次", "4次"], userSelection: 2 }],
        },
        plans: [],
        inserted: null,
    };
    mocks.generatePersonalizedPlan.mockRejectedValue(new Error("Request timed out."));
    mocks.matchPlan.mockResolvedValue([]);
    mocks.findClosestPlans.mockResolvedValue([]);
    mocks.archive.mockResolvedValue({ archivedIds: [] });
});

describe("createAiInstanceForSubscription rule fallback", () => {
    it("uses the closest template when no template matches the weekly days exactly", async () => {
        mocks.findClosestPlans.mockResolvedValue([template("tpl-3x")]);

        const plan = await createAiInstanceForSubscription(params());

        expect(mocks.findClosestPlans).toHaveBeenCalledWith(mocks.store.subscription.subscribe_data, COACH_USER);
        expect(plan.id).toBe("plan-new");
        expect(mocks.store.inserted).toMatchObject({
            // Not linked: update-template "sync instances" would overwrite the filled-in loads.
            coach_plan_template_id: null,
            ai_generation_log: { fallback: { mode: "closest_match", reason: "Request timed out.", templateId: "tpl-3x" } },
        });
    });

    it("prefers an exact match and records it as rule_match", async () => {
        mocks.matchPlan.mockResolvedValue([template("tpl-exact")]);
        mocks.findClosestPlans.mockResolvedValue([template("tpl-3x")]);

        await createAiInstanceForSubscription(params());

        expect(mocks.findClosestPlans).not.toHaveBeenCalled();
        expect(mocks.store.inserted.ai_generation_log.fallback.mode).toBe("rule_match");
        expect(mocks.store.inserted.ai_generation_log.fallback.templateId).toBe("tpl-exact");
    });

    it("skips exact matches that have no training actions", async () => {
        mocks.matchPlan.mockResolvedValue([template("tpl-empty", { training_days: [{ type: "rest", actionSets: [] }] })]);
        mocks.findClosestPlans.mockResolvedValue([template("tpl-3x")]);

        await createAiInstanceForSubscription(params());

        expect(mocks.store.inserted.ai_generation_log.fallback.templateId).toBe("tpl-3x");
    });

    it("keeps one-filter templates, whose actions sit inside actions[]", async () => {
        mocks.matchPlan.mockResolvedValue([template("tpl-filter", {
            training_days: [{
                type: "training",
                dayIndex: 1,
                actionSets: [{ type: "one-filter", question: { question: "器械" }, actions: [{ actionId: "act-1", params: {} }] }],
            }],
        })]);
        mocks.fillTemplate.mockImplementation(async (_answers: any, tpl: any) => {
            tpl.training_days[0].actionSets = [{ type: "no-filter", actionId: "act-1", params: {} }];
        });

        await createAiInstanceForSubscription(params());

        expect(mocks.store.inserted.ai_generation_log.fallback.templateId).toBe("tpl-filter");
    });

    it("fails with the AI reason when there is no usable template at all", async () => {
        const error = await createAiInstanceForSubscription(params()).catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.message).toContain("没有匹配的训练计划");
        expect(error.message).toContain("Request timed out.");
        expect(mocks.store.inserted).toBeNull();
    });

    it("treats a missing questionnaire as empty answers instead of crashing", async () => {
        mocks.store.subscription.subscribe_data = null;
        mocks.findClosestPlans.mockResolvedValue([template("tpl-3x")]);

        await createAiInstanceForSubscription(params());

        expect(mocks.matchPlan).toHaveBeenCalledWith([], COACH_USER);
        expect(mocks.store.inserted.ai_generation_log.fallback.templateId).toBe("tpl-3x");
    });
});

describe("createAiInstanceForSubscription current-plan re-check", () => {
    it("stops before archiving when a current plan appeared during generation", async () => {
        mocks.findClosestPlans.mockResolvedValue([template("tpl-3x")]);
        mocks.store.plans = [{ id: "plan-by-coach", status: "active" }];

        const error = await createAiInstanceForSubscription(params({ skipIfCurrentPlanExists: true })).catch((e) => e);

        expect(error).toBeInstanceOf(PlanAlreadyExistsError);
        expect(error.planInstanceId).toBe("plan-by-coach");
        expect(mocks.archive).not.toHaveBeenCalled();
        expect(mocks.store.inserted).toBeNull();
    });

    it("ignores finished plans from an earlier period", async () => {
        mocks.findClosestPlans.mockResolvedValue([template("tpl-3x")]);
        mocks.store.plans = [{ id: "plan-old", status: "completed" }];

        await createAiInstanceForSubscription(params({ skipIfCurrentPlanExists: true }));

        expect(mocks.store.inserted).toMatchObject({ coach_subscription_id: "sub-1", status: "active" });
    });

    it("keeps the old archive-and-replace behaviour for manual creation", async () => {
        mocks.findClosestPlans.mockResolvedValue([template("tpl-3x")]);
        mocks.store.plans = [{ id: "plan-current", status: "active" }];

        await createAiInstanceForSubscription(params());

        expect(mocks.archive).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: "sub-1" }));
        expect(mocks.store.inserted).not.toBeNull();
    });
});
