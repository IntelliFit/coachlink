import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type SupabaseExecContext } from "@/testUtils/mockSupabase";

const COACH_USER = "coach-user-1";
const SUB = "sub-1";

const mocks = vi.hoisted(() => ({
    store: {} as Record<string, any>,
    createAi: vi.fn(),
    sendSystemMessage: vi.fn(),
    startPlanIntake: vi.fn(),
    policy: { initialPlanMode: "auto_publish" } as Record<string, any>,
}));

function filterValue(ctx: SupabaseExecContext, kind: string, column: string) {
    return ctx.filters.find((f) => f.kind === kind && f.args[0] === column)?.args[1];
}

vi.mock("@/lib/supabaseClient", () => {
    const client = createMockSupabase(async (ctx: SupabaseExecContext) => {
        const s = mocks.store;
        if (ctx.table === "coach_automation_jobs") {
            if (ctx.op === "update") {
                const job = s.jobs[filterValue(ctx, "eq", "id")];
                const status = filterValue(ctx, "eq", "status");
                const updatedAt = filterValue(ctx, "eq", "updated_at");
                if (!job || (status !== undefined && job.status !== status) || (updatedAt !== undefined && job.updated_at !== updatedAt)) {
                    return { data: [], error: null };
                }
                Object.assign(job, ctx.payload, { updated_at: `${ctx.payload.updated_at}#${++s.writes}` });
                return { data: [{ ...job }], error: null };
            }
            return { data: Object.values(s.jobs).map((job: any) => ({ ...job })), error: null };
        }
        if (ctx.table === "coach_subscriptions") return { data: s.subscription, error: null };
        if (ctx.table === "coach_plan_instances") {
            const statuses = filterValue(ctx, "in", "status") as string[] | undefined;
            const match = (s.plans as any[]).find((plan) => !statuses || statuses.includes(plan.status));
            return { data: match || null, error: null };
        }
        return { data: null, error: null };
    });
    return { default: client, serviceRoleSupabase: client };
});

vi.mock("@/app/api/plan-lib/create-ai-instance/service", () => {
    class PlanAlreadyExistsError extends Error {
        planInstanceId: string;
        constructor(planInstanceId: string) {
            super("该学员已有当前训练计划，已停止自动创建");
            this.planInstanceId = planInstanceId;
        }
    }
    return { createAiInstanceForSubscription: mocks.createAi, PlanAlreadyExistsError };
});
vi.mock("@/lib/chat", () => ({ sendSystemMessage: mocks.sendSystemMessage }));
vi.mock("./planIntake", () => ({ startPlanIntake: mocks.startPlanIntake }));
vi.mock("./policy", () => ({
    resolveAutomationPolicy: async () => ({
        policy: mocks.policy,
        context: { subscriptionId: SUB, coachId: "coach-1", studentId: "student-1", coachUserId: COACH_USER },
    }),
}));
// The real upsert needs a database; keep one row per idempotency key like the unique index does.
vi.mock("./jobs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./jobs")>();
    return {
        ...actual,
        createAutomationJob: vi.fn(async (input: any) => {
            const s = mocks.store;
            const existing = Object.values(s.jobs).find((job: any) => job.idempotency_key === input.idempotencyKey) as any;
            if (existing) return { ...existing };
            const id = `job-${Object.keys(s.jobs).length + 1}`;
            s.jobs[id] = {
                id,
                type: input.type,
                status: "pending",
                idempotency_key: input.idempotencyKey,
                subscription_id: input.subscriptionId,
                input_snapshot: input.inputSnapshot,
                output_snapshot: null,
                updated_at: "t0",
            };
            return { ...s.jobs[id] };
        }),
    };
});

import { PlanAlreadyExistsError } from "@/app/api/plan-lib/create-ai-instance/service";
import { isRetryableInitialPlanJob, onSubscriptionActivated, retryUnfinishedInitialPlans } from "./initialPlan";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const onlyJob = () => Object.values(mocks.store.jobs)[0] as any;
const coachMessages = () => mocks.sendSystemMessage.mock.calls.map((call) => String(call[1]?.content || ""));

function seedJob(extra: Record<string, any>) {
    mocks.store.jobs["job-1"] = {
        id: "job-1",
        type: "initial_plan",
        status: "pending",
        idempotency_key: `initial_plan:${SUB}`,
        subscription_id: SUB,
        input_snapshot: {},
        output_snapshot: null,
        updated_at: "t0",
        ...extra,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.store = {
        jobs: {},
        writes: 0,
        subscription: { id: SUB, status: "active", subscribe_data: [{ type: "option", question: "目标", userSelection: 0 }] },
        plans: [],
    };
    mocks.policy = { initialPlanMode: "auto_publish" };
    mocks.createAi.mockResolvedValue({ id: "plan-1", name: "小王的计划", ai_generation_log: null });
    mocks.startPlanIntake.mockResolvedValue({ status: "not_needed", questions: [] });
    mocks.sendSystemMessage.mockResolvedValue(true);
});

describe("onSubscriptionActivated", () => {
    it("publishes the plan, re-checks plans before writing, and tells the coach once", async () => {
        const result = await onSubscriptionActivated(SUB, "test");

        expect(result).toMatchObject({ success: true, planInstanceId: "plan-1" });
        expect(mocks.createAi).toHaveBeenCalledWith(expect.objectContaining({
            subscriptionId: SUB,
            initialStatus: "active",
            useLLM: true,
            skipIfCurrentPlanExists: true,
        }));
        expect(onlyJob()).toMatchObject({ status: "succeeded", plan_instance_id: "plan-1" });
        expect(coachMessages()).toHaveLength(1);
        expect(coachMessages()[0]).toContain("已自动发放：小王的计划");
    });

    it("runs once when two triggers arrive together", async () => {
        const [first, second] = await Promise.all([
            onSubscriptionActivated(SUB, "payment_notify"),
            onSubscriptionActivated(SUB, "payment_query"),
        ]);

        expect(mocks.createAi).toHaveBeenCalledTimes(1);
        expect([first, second].filter((r) => r.duplicate)).toHaveLength(1);
        expect([first, second].find((r) => r.duplicate)?.reason).toBe("in_progress");
    });

    it("records the failure, tells the coach why, and stays retryable", async () => {
        mocks.createAi.mockRejectedValueOnce(new Error("没有匹配的训练计划：AI 生成失败（Request timed out.），教练模板库里也没有带训练动作的模板"));

        const failed = await onSubscriptionActivated(SUB, "test");

        expect(failed.success).toBe(false);
        expect(onlyJob().status).toBe("failed");
        expect(onlyJob().error_message).toContain("Request timed out.");
        expect(onlyJob().output_snapshot).toMatchObject({ attempts: 1 });
        expect(onlyJob().output_snapshot.coachNotifiedAt).toBeTruthy();
        expect(coachMessages()[0]).toContain("首个训练计划自动生成失败");
        expect(coachMessages()[0]).toContain("Request timed out.");

        const retried = await onSubscriptionActivated(SUB, "coach_retry");

        expect(retried).toMatchObject({ success: true, planInstanceId: "plan-1" });
        expect(mocks.createAi).toHaveBeenCalledTimes(2);
        expect(onlyJob().status).toBe("succeeded");
        expect(onlyJob().output_snapshot.attempts).toBe(2);
    });

    it("does not repeat the failure message on automatic retries, but answers a coach retry", async () => {
        mocks.createAi.mockRejectedValue(new Error("数据库超时"));

        await onSubscriptionActivated(SUB, "test");
        await onSubscriptionActivated(SUB, "initial_plan_retry");
        expect(coachMessages()).toHaveLength(1);

        await onSubscriptionActivated(SUB, "coach_retry");
        expect(coachMessages()).toHaveLength(2);
    });

    it("skips quietly when the student already has a plan", async () => {
        mocks.store.plans = [{ id: "plan-old", status: "archived" }];

        const result = await onSubscriptionActivated(SUB, "test");

        expect(result).toMatchObject({ success: false, reason: "plan_instance_exists", planInstanceId: "plan-old" });
        expect(mocks.createAi).not.toHaveBeenCalled();
        expect(mocks.sendSystemMessage).not.toHaveBeenCalled();
    });

    it("stops without archiving when a plan appeared while the AI was running", async () => {
        mocks.createAi.mockRejectedValueOnce(new PlanAlreadyExistsError("plan-by-coach"));

        const result = await onSubscriptionActivated(SUB, "test");

        expect(result).toMatchObject({ reason: "plan_instance_exists", planInstanceId: "plan-by-coach" });
        expect(onlyJob()).toMatchObject({ status: "skipped", plan_instance_id: "plan-by-coach" });
        expect(onlyJob().output_snapshot).toMatchObject({ createdDuringRun: true });
        expect(mocks.sendSystemMessage).not.toHaveBeenCalled();
    });

    it("treats a finished job as already handled", async () => {
        seedJob({ status: "succeeded", plan_instance_id: "plan-1" });

        const result = await onSubscriptionActivated(SUB, "test");

        expect(result).toMatchObject({ success: true, duplicate: true, reason: "already_handled" });
        expect(mocks.createAi).not.toHaveBeenCalled();
        expect(mocks.sendSystemMessage).not.toHaveBeenCalled();
    });

    it("leaves a fresh running job alone but takes over one orphaned by a restart", async () => {
        seedJob({ status: "running", started_at: minutesAgo(2) });
        expect(await onSubscriptionActivated(SUB, "test")).toMatchObject({ reason: "in_progress", duplicate: true });
        expect(mocks.createAi).not.toHaveBeenCalled();

        mocks.store.jobs["job-1"].started_at = minutesAgo(20);
        expect(await onSubscriptionActivated(SUB, "test")).toMatchObject({ success: true, planInstanceId: "plan-1" });
    });

    it("gives a new paid period on a reused subscription its own job and ignores the old period's plans", async () => {
        seedJob({ status: "succeeded", plan_instance_id: "plan-old" });
        mocks.store.plans = [{ id: "plan-old", status: "completed" }];

        const result = await onSubscriptionActivated(SUB, "test", { periodKey: "order-2" });

        expect(result).toMatchObject({ success: true, planInstanceId: "plan-1" });
        const newJob = Object.values(mocks.store.jobs).find((job: any) => job.idempotency_key === `initial_plan:${SUB}:order-2`);
        expect(newJob).toMatchObject({ status: "succeeded" });
    });

    it("still skips a new period while the old plan is current", async () => {
        mocks.store.plans = [{ id: "plan-old", status: "active" }];

        const result = await onSubscriptionActivated(SUB, "test", { periodKey: "order-2" });

        expect(result.reason).toBe("plan_instance_exists");
        expect(mocks.createAi).not.toHaveBeenCalled();
    });

    it("builds a plan from the profile when the coach has no questionnaire", async () => {
        mocks.store.subscription = { id: SUB, status: "active", subscribe_data: [] };

        const result = await onSubscriptionActivated(SUB, "test");

        expect(result.success).toBe(true);
        expect(coachMessages()[0]).toContain("学员没有填写问卷");
    });

    it("tells the coach when the plan came from the rule fallback", async () => {
        mocks.createAi.mockResolvedValueOnce({
            id: "plan-1",
            name: "小王的计划",
            ai_generation_log: { fallback: { mode: "closest_match", reason: "Request timed out." } },
        });

        await onSubscriptionActivated(SUB, "test");

        expect(coachMessages()[0]).toContain("AI 个性化没有成功（Request timed out.）");
        expect(coachMessages()[0]).toContain("最接近的模板");
        expect(onlyJob().output_snapshot.fallback).toMatchObject({ mode: "closest_match" });
    });

    it("reminds the coach once when automatic first plans are off", async () => {
        mocks.policy = { initialPlanMode: "off" };

        await onSubscriptionActivated(SUB, "test");
        await onSubscriptionActivated(SUB, "test");

        expect(mocks.createAi).not.toHaveBeenCalled();
        expect(onlyJob()).toMatchObject({ status: "skipped" });
        expect(coachMessages()).toHaveLength(1);
        expect(coachMessages()[0]).toContain("关闭了自动生成首个计划");
    });

    it("saves a draft and asks the coach to publish it in draft mode", async () => {
        mocks.policy = { initialPlanMode: "draft" };

        await onSubscriptionActivated(SUB, "test");

        expect(mocks.createAi).toHaveBeenCalledWith(expect.objectContaining({ initialStatus: "draft" }));
        expect(onlyJob()).toMatchObject({ status: "needs_coach_review" });
        expect(coachMessages()[0]).toContain("首个训练计划草稿");
    });
});

describe("retryUnfinishedInitialPlans", () => {
    it("picks orphaned, stuck and old failed jobs, and leaves the rest", () => {
        const now = Date.now();
        const job = (extra: Record<string, any>) => ({ id: "j", type: "initial_plan", subscription_id: SUB, idempotency_key: "k", ...extra }) as any;

        expect(isRetryableInitialPlanJob(job({ status: "running", started_at: minutesAgo(20) }), now)).toBe(true);
        expect(isRetryableInitialPlanJob(job({ status: "running", started_at: minutesAgo(2) }), now)).toBe(false);
        expect(isRetryableInitialPlanJob(job({ status: "pending", updated_at: minutesAgo(10) }), now)).toBe(true);
        expect(isRetryableInitialPlanJob(job({ status: "failed", finished_at: minutesAgo(40), output_snapshot: { attempts: 1 } }), now)).toBe(true);
        expect(isRetryableInitialPlanJob(job({ status: "failed", finished_at: minutesAgo(5), output_snapshot: { attempts: 1 } }), now)).toBe(false);
        expect(isRetryableInitialPlanJob(job({ status: "failed", finished_at: minutesAgo(40), output_snapshot: { attempts: 3 } }), now)).toBe(false);
        expect(isRetryableInitialPlanJob(job({ status: "succeeded" }), now)).toBe(false);
        expect(isRetryableInitialPlanJob(job({ status: "running", type: "next_phase", started_at: minutesAgo(20) }), now)).toBe(false);
    });

    it("re-runs an orphaned job with its period key", async () => {
        seedJob({
            status: "running",
            started_at: minutesAgo(30),
            idempotency_key: `initial_plan:${SUB}:order-9`,
            input_snapshot: { periodKey: "order-9" },
        });

        const results = await retryUnfinishedInitialPlans();

        expect(results).toEqual([expect.objectContaining({ success: true, planInstanceId: "plan-1" })]);
        expect(onlyJob()).toMatchObject({ status: "succeeded", plan_instance_id: "plan-1" });
        expect(Object.keys(mocks.store.jobs)).toHaveLength(1);
    });
});
