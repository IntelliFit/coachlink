/**
 * 教练全自动托管闭环的端到端测试台：订阅生效 → 生成首个计划 → 计划助理私信 →
 * 学员经 send-message 回复 → 记录 1RM/体重 → 开始训练和计划页按新 1RM 算重量。
 *
 * 全部离线：Supabase 换成内存库（src/testUtils/fakeSupabase.ts），三个大模型
 * （计划生成、回复提取、AI 自动回复）按场景脚本作答，登录身份由请求头 x-test-user-id 决定，
 * next/server 的 after() 排进队列，由测试决定什么时候跑。
 *
 * 用法见同目录的 *.test.ts：每个测试文件顶部用 vi.mock 接入 mockModules 里的工厂。
 */
import { vi } from "vitest";
import { FakeSupabase, type FakeRow } from "@/testUtils/fakeSupabase";
import { parsePlanScript } from "@/lib/planScript";
import { calculateE1RM } from "@/lib/e1rmCalculator";
import { calcIntensityDisplay } from "@/lib/rmCaculator";
import { formatKgForGym } from "@/lib/weightQuantize";

// ---------------------------------------------------------------------------
// 固定 id（v4 格式：get-current-1rm 只认 v1-5 UUID 作为动作 id）

const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

export const IDS = {
    admin: uuid(1),
    coachUser: uuid(2),
    coach: uuid(3),
    student: uuid(4),
    otherStudent: uuid(5),
    subscription: uuid(10),
    oldSubscription: uuid(11),
    template: uuid(20),
    squat: uuid(30),
    bench: uuid(31),
    deadlift: uuid(32),
    pullup: uuid(33),
} as const;

export const ACTION_NAMES: Record<string, string> = {
    [IDS.squat]: "深蹲",
    [IDS.bench]: "卧推",
    [IDS.deadlift]: "硬拉",
    [IDS.pullup]: "负重引体",
};

/** 默认计划：深蹲/卧推（D1、D5），硬拉/负重引体（D3），RM 与百分比强度混用。 */
export const DEFAULT_PLAN_SCRIPT = [
    "W1",
    "D1",
    "深蹲 5x5 @5rm r180",
    "卧推 4x6 @75% r150",
    "D2 off",
    "D3",
    "硬拉 3x5 @5rm r180",
    "负重引体 4x5 @5rm r150",
    "D4 off",
    "D5",
    "深蹲 3x8 @8rm r150",
    "卧推 3x8 @8rm r120",
    "D6 off",
    "D7 off",
].join("\n");

const START_TIME = new Date("2026-11-04T02:00:00.000Z");
const QUERY_LATENCY_MS = 5;

// ---------------------------------------------------------------------------
// 大模型脚本

export type IntakeQuestionView = { id: string; type: string; action?: string; prompt?: string };
export type IntakeReplyInput = {
    questions: IntakeQuestionView[];
    messages: string[];
    /** 动作名 → 问题 id */
    q: (actionName: string) => string;
};
export type IntakeReplyScript = (input: IntakeReplyInput) => unknown | Promise<unknown>;

export type LlmCall = { kind: string; prompt: string };

type ScenarioLlm = {
    /** Stage B 返回的 plan_script；null 表示计划模型报错（走规则匹配兜底） */
    planScript: string | null;
    openQuestions: string[];
    intakeReply: IntakeReplyScript | null;
    /** 回复提取调用前等待（测试用来卡住第一条消息的处理） */
    intakeGate: (() => Promise<void>) | null;
    intakeLatencyMs: number;
    autoReplyText: string;
};

// ---------------------------------------------------------------------------
// 期望值：用产品自己的公式算，测试只验证链路有没有把数字送到

export const expected = {
    e1rm(weight: number, reps: number, bodyWeight = 0) {
        return calculateE1RM({ weight, reps, bodyWeight, includeBodyWeight: bodyWeight > 0 }).e1rm;
    },
    /** RM 强度在训练开始时显示的重量（按 2.5kg 取整） */
    rmKg(oneRM: number, rm: number, bodyWeight = 0) {
        return formatKgForGym(expected.rmLoad(oneRM, rm, bodyWeight));
    },
    /** RM 强度在计划里存的/计划页算出的原始重量 */
    rmLoad(oneRM: number, rm: number, bodyWeight = 0) {
        const result = calcIntensityDisplay({
            intensityConfig: { relativeIntensity: { type: "rm", value: rm } },
            oneRM,
            bodyWeight,
            includesBodyWeight: bodyWeight > 0,
        });
        if (result.displayWeight === undefined || result.displayWeight === null) throw new Error("no kg for this input");
        return Number(result.displayWeight);
    },
    pctKg(oneRM: number, pct: number) {
        return formatKgForGym(Math.round(oneRM * pct * 10 / 100) / 10);
    },
};

/** 回复提取模型的 JSON（没给的字段取空值）。 */
export function extraction(partial: Record<string, unknown> = {}) {
    return {
        related: true,
        bodyWeightKg: null,
        oneRmAnswers: [],
        openAnswers: [],
        unknownQuestionIds: [],
        riskNotes: "",
        otherNotes: "",
        ...partial,
    };
}

function parseIntakePrompt(prompt: string): Omit<IntakeReplyInput, "q"> {
    const questions: IntakeQuestionView[] = [];
    for (const line of prompt.split("\n")) {
        const match = line.match(/^- id=(\S+) \| 类型=([^|]+?)(?: \| 动作=([^|]+?))?(?: \| (?:问题=)?(.*))?$/);
        if (!match) continue;
        questions.push({
            id: match[1],
            type: match[2].trim(),
            action: match[3]?.trim(),
            prompt: match[2].trim() === "开放问题" ? match[4]?.trim() : undefined,
        });
    }
    const messages = [...prompt.matchAll(/^\[学员消息\d+\] (.*)$/gm)].map((m) => m[1]);
    return { questions, messages };
}

function completion(content: string) {
    return { choices: [{ message: { content }, finish_reason: "stop" }], usage: null };
}

// ---------------------------------------------------------------------------
// 世界状态（每个测试 resetWorld 一次）

type AfterTask = () => unknown;

export type World = {
    db: FakeSupabase;
    llm: ScenarioLlm;
    llmCalls: LlmCall[];
    afterQueue: AfterTask[];
    errors: unknown[][];
    fetchCalls: string[];
};

export const world: World = {
    db: new FakeSupabase(),
    llm: defaultLlm(),
    llmCalls: [],
    afterQueue: [],
    errors: [],
    fetchCalls: [],
};

function defaultLlm(): ScenarioLlm {
    return {
        planScript: DEFAULT_PLAN_SCRIPT,
        openQuestions: [],
        intakeReply: null,
        intakeGate: null,
        intakeLatencyMs: 1500,
        autoReplyText: "（AI 分身）收到，教练看到后会再回复你。",
    };
}

function advanceClock(ms: number) {
    vi.setSystemTime(new Date(Date.now() + ms));
}

async function handleLlm(kind: string, body: any): Promise<ReturnType<typeof completion>> {
    const prompt = String(body?.messages?.map((m: any) => m?.content).join("\n\n") || "");
    world.llmCalls.push({ kind, prompt });

    if (kind === "plan") {
        advanceClock(3000);
        if (prompt.includes("【可用模板列表】")) {
            return completion(JSON.stringify({ template_id: IDS.template, reasoning: "最接近学员目标", confidence: 0.9 }));
        }
        if (world.llm.planScript === null) throw new Error("plan model unavailable (scripted)");
        return completion(JSON.stringify({
            plan_script: world.llm.planScript,
            reasoning: "按模板保守调整",
            changes_summary: "保留模板结构",
            open_questions: world.llm.openQuestions,
        }));
    }

    if (kind === "fast") {
        if (world.llm.intakeGate) await world.llm.intakeGate();
        advanceClock(world.llm.intakeLatencyMs);
        const script = world.llm.intakeReply;
        if (!script) throw new Error("intake reply model called but the scenario has no script");
        const parsed = parseIntakePrompt(prompt);
        const q = (actionName: string) => {
            const found = parsed.questions.find((item) => item.action === actionName);
            if (!found) throw new Error(`scripted intake reply: no pending question for ${actionName}`);
            return found.id;
        };
        const result = await script({ ...parsed, q });
        return completion(typeof result === "string" ? result : JSON.stringify(result));
    }

    if (kind === "coachReply") {
        advanceClock(2000);
        return completion(world.llm.autoReplyText);
    }

    throw new Error(`unexpected LLM call (${kind}) in the automation harness`);
}

function fakeLlmClient(kind: string) {
    return {
        client: { chat: { completions: { create: (body: any) => handleLlm(kind, body) } } },
        model: `fake-${kind}`,
        provider: "wanjie-ark" as const,
    };
}

// ---------------------------------------------------------------------------
// 给 vi.mock 用的模块工厂

export const mockModules = {
    supabaseClient: () => ({
        default: new Proxy({}, { get: (_, prop) => (world.db as any)[prop]?.bind?.(world.db) ?? (world.db as any)[prop] }),
        serviceRoleSupabase: new Proxy({}, { get: (_, prop) => (world.db as any)[prop]?.bind?.(world.db) ?? (world.db as any)[prop] }),
    }),
    coachlinkLlm: () => ({
        WANJIE_ARK_DEFAULT_BASE_URL: "http://llm.invalid",
        WANJIE_ARK_DEFAULT_ANTHROPIC_MESSAGES_URL: "http://llm.invalid",
        getCoachlinkLlm: () => fakeLlmClient("default"),
        getCoachlinkPlanLlm: () => fakeLlmClient("plan"),
        getCoachlinkPlanScriptLlm: () => fakeLlmClient("planScript"),
        getCoachlinkPlanScriptFallbackLlm: () => fakeLlmClient("planScript"),
        getCoachlinkCoachReplyLlm: () => fakeLlmClient("coachReply"),
        getCoachlinkVisionLlm: () => fakeLlmClient("vision"),
        getCoachlinkFastLlm: () => fakeLlmClient("fast"),
    }),
    getApiUserId: () => ({
        getApiUserId: async (req: Pick<Request, "headers">) => req.headers.get("x-test-user-id"),
    }),
    auth: () => ({
        getAuthUser: async (req: Request) => {
            const userId = req.headers.get("x-test-user-id");
            if (!userId) return { isAuthenticated: false, userId: null, user: null };
            const user = world.db.rows("users", (row) => row.id === userId)[0] || { id: userId };
            return { isAuthenticated: true, userId, user };
        },
    }),
    nextAuth: () => ({
        getServerSession: async () => null,
    }),
    nextServer: async (importOriginal: () => Promise<any>) => {
        const actual = await importOriginal();
        return {
            ...actual,
            after: (task: unknown) => {
                world.afterQueue.push(() => (typeof task === "function" ? (task as () => unknown)() : task));
            },
        };
    },
};

// ---------------------------------------------------------------------------
// 初始数据

const ACTION_ATTRS = ["组数", "次数", "强度", "休息时间"];

function coachActionRows(): FakeRow[] {
    return [
        { id: IDS.squat, name: "深蹲", includesBodyWeight: false },
        { id: IDS.bench, name: "卧推", includesBodyWeight: false },
        { id: IDS.deadlift, name: "硬拉", includesBodyWeight: false },
        { id: IDS.pullup, name: "负重引体", includesBodyWeight: true },
    ].map((action) => ({
        ...action,
        coach_id: IDS.coachUser,
        type: "STRENGTH",
        attrs: ACTION_ATTRS,
        enableAutoWeightCompute: true,
        canonical_action_id: null,
        detail: null,
    }));
}

export function buildTrainingDays(script: string) {
    const actions = coachActionRows().map((row) => ({ id: row.id, name: row.name, type: row.type }));
    return parsePlanScript({ script, actions: actions as any }).days;
}

export function questionnaire(rmInputs: Record<string, number> = {}) {
    return [
        { id: "q-times", type: "option", question: "每周训练次数", options: ["3次"], userSelection: 0 },
        { id: "q-goal", type: "text", question: "你的训练目标是什么？", userInput: "提升三大项力量" },
        { id: "q-rm", type: "rm", question: "已知的 1RM", userInputs: rmInputs },
    ];
}

export type WorldOptions = {
    studentProfile?: Partial<FakeRow>;
    /** 学员自己的 PR 历史 */
    studentPrs?: Array<{ actionId: string; e1rm: number; daysAgo?: number }>;
    initialPlanMode?: "off" | "draft" | "auto_publish";
    autoReplyEnabled?: boolean;
    /** 学员此前已在同一教练处有一份订阅（复购） */
    repurchase?: boolean;
    questionnaireRm?: Record<string, number>;
};

function isoDaysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}

export function resetWorld(options: WorldOptions = {}) {
    vi.useFakeTimers({ toFake: ["Date"], now: START_TIME });

    const db = new FakeSupabase({
        relations: [
            { table: "coach_subscriptions", name: "coaches", localColumn: "coach_id", foreignColumn: "id", kind: "one" },
        ],
        tables: {
            coach_automation_jobs: {
                unique: [["idempotency_key"]],
                defaults: () => ({ status: "pending", needs_coach_confirmation: false, output_snapshot: null }),
            },
            chat_messages: { defaults: () => ({ content_metadata: null }) },
            chat_rooms: { defaults: () => ({ type: "private", is_archived: false, unread_members: [] }) },
            coach_plan_instances: { defaults: () => ({ source: "coach", revision_of_instance_id: null }) },
        },
    });
    db.beforeExec = async () => {
        advanceClock(QUERY_LATENCY_MS);
        await new Promise((resolve) => setImmediate(resolve));
    };
    db.defineRpc("create_plan_execution_atomic", (args, self) => {
        const instance = self.table("coach_plan_instances").find((row) => row.id === args.p_instance_id);
        if (!instance || instance.status !== "active") {
            return { data: null, error: { message: "PLAN_INSTANCE_NOT_CURRENT" } };
        }
        const now = new Date().toISOString();
        const row = self.withDefaults("plan_instance_executions", {
            instance_id: args.p_instance_id,
            student_id: args.p_student_id,
            day_index: args.p_day_index,
            action_executions: args.p_action_executions,
            total_sets: args.p_total_sets,
            completed_sets: 0,
            status: "in_progress",
            started_at: now,
            updated_at: now,
        });
        self.table("plan_instance_executions").push(row);
        return { data: [row], error: null };
    });
    db.defineRpc("activate_pending_plan_revision_atomic", () => ({ data: null, error: null }));

    db.seed("users", [
        { id: IDS.admin, is_coach: false },
        { id: IDS.coachUser, is_coach: true },
        { id: IDS.student, is_coach: false },
        { id: IDS.otherStudent, is_coach: false },
    ]);
    db.seed("admin_users", [{ user_id: IDS.admin }]);
    db.seed("coaches", [{ id: IDS.coach, user_id: IDS.coachUser, name: "李教练", profile: {} }]);
    db.seed("user_profiles", [
        // 教练本人也练：他自己的 PR 和运动卡不能被当成学员的 1RM。
        {
            user_id: IDS.coachUser,
            nickname: "李教练",
            weight: 90,
            sport_cards: { powerlifting: { squat: 230, bench: 160, deadlift: 260 } },
        },
        { user_id: IDS.student, nickname: "小王", full_name: null, weight: null, sport_cards: null, ...options.studentProfile },
    ]);
    db.seed("coach_actions", coachActionRows());
    db.seed("coach_plan_templates", [{
        id: IDS.template,
        coach_id: IDS.coachUser,
        name: "三大项基础力量",
        description: "每周三练的基础力量模板",
        execution_notice: null,
        type: "strength",
        suitable_for: null,
        tags: [],
        week_days: [3],
        metadata: {},
        training_days: buildTrainingDays(DEFAULT_PLAN_SCRIPT),
    }]);
    db.seed("personal_records_history", [
        { user_id: IDS.coachUser, action_id: IDS.squat, exercise_name: "深蹲", e1rm: 230, date_achieved: "2026-10-01", is_auto_calculated: false },
        { user_id: IDS.coachUser, action_id: IDS.bench, exercise_name: "卧推", e1rm: 160, date_achieved: "2026-10-01", is_auto_calculated: false },
        ...(options.studentPrs || []).map((pr) => ({
            user_id: IDS.student,
            action_id: pr.actionId,
            exercise_name: ACTION_NAMES[pr.actionId],
            e1rm: pr.e1rm,
            date_achieved: isoDaysAgo(pr.daysAgo ?? 30).slice(0, 10),
            created_at: isoDaysAgo(pr.daysAgo ?? 30),
            is_auto_calculated: false,
        })),
    ]);
    db.seed("coach_subscriptions", [
        ...(options.repurchase ? [{
            id: IDS.oldSubscription,
            coach_id: IDS.coach,
            student_id: IDS.student,
            status: "expired",
            subscribed_weeks: 4,
            subscribe_data: questionnaire(),
            start_date: isoDaysAgo(60),
            updated_at: isoDaysAgo(30),
        }] : []),
        {
            id: IDS.subscription,
            coach_id: IDS.coach,
            student_id: IDS.student,
            status: "active",
            subscribed_weeks: 4,
            subscribe_data: questionnaire(options.questionnaireRm),
            start_date: null,
            end_date: null,
            payment_data: null,
            updated_at: START_TIME.toISOString(),
        },
    ]);
    if (options.initialPlanMode) {
        db.seed("coach_automation_policies", [{ coach_id: IDS.coach, initial_plan_mode: options.initialPlanMode }]);
    }
    db.seed("coach_ai_auto_reply_settings", [{
        coach_user_id: IDS.coachUser,
        enabled: options.autoReplyEnabled === true,
        system_prompt: null,
        knowledge_base: null,
        knowledge_documents: [],
        model: null,
    }]);

    world.db = db;
    world.llm = defaultLlm();
    world.llmCalls = [];
    world.afterQueue = [];
    world.errors = [];
    world.fetchCalls = [];
    return world;
}

/** 安静的控制台 + 断网：任何真实网络请求都直接失败。 */
export function installSandbox() {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        world.errors.push(args);
    });
    vi.stubGlobal("fetch", async (input: unknown) => {
        world.fetchCalls.push(String(input));
        throw new Error(`network disabled in the automation harness: ${String(input)}`);
    });
}

// ---------------------------------------------------------------------------
// 驱动闭环的动作

export async function activateSubscription(subscriptionId: string = IDS.subscription) {
    const { autoMatchPlanForSubscription } = await import("@/app/api/plan-lib/auto-match-plan/service");
    return autoMatchPlanForSubscription(subscriptionId, IDS.coachUser, IDS.coach);
}

function jsonRequest(path: string, userId: string, body: unknown) {
    // 用全局 Request：harness 不能静态引用 next/server（它被 mock，工厂又会加载本文件）。
    return new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user-id": userId },
        body: JSON.stringify(body),
    });
}

export function privateRoomId(a: string = IDS.student, b: string = IDS.coachUser): string {
    const room = world.db.rows("chat_rooms", (row) =>
        row.type === "private" && Array.isArray(row.members) && row.members.includes(a) && row.members.includes(b))[0];
    if (!room) throw new Error("private room between student and coach does not exist yet");
    return room.id;
}

/** 学员在和教练的私聊里发一条文字消息（走真实 send-message 路由）。after() 任务留在队列里。 */
export async function studentSends(content: string, userId: string = IDS.student) {
    const { POST } = await import("@/app/api/chat/send-message/route");
    const response = await POST(jsonRequest("/api/chat/send-message", userId, {
        roomId: privateRoomId(userId),
        messageType: "text",
        content,
    }));
    const json = await response.json();
    if (!json.success) throw new Error(`send-message failed: ${json.message}`);
    return json.data as { messageId: string; createdAt: string };
}

/** 跑完队列里的 after() 任务（并发执行，模拟几个请求的后台处理同时进行）。 */
export async function runAfterTasks() {
    while (world.afterQueue.length > 0) {
        const tasks = world.afterQueue.splice(0, world.afterQueue.length);
        await Promise.all(tasks.map((task) => task()));
    }
}

export async function startTraining(instanceId: string, dayIndex: number) {
    const { POST } = await import("@/app/api/execution/start/route");
    const response = await POST(jsonRequest("/api/execution/start", IDS.student, { instanceId, dayIndex }) as any);
    return { status: response.status, json: await response.json() };
}

export async function getInstance(instanceId: string, userId: string = IDS.student) {
    const { POST } = await import("@/app/api/plan-lib/get-instance/route");
    const response = await POST(jsonRequest("/api/plan-lib/get-instance", userId, { id: instanceId }));
    return { status: response.status, json: await response.json() };
}

// ---------------------------------------------------------------------------
// 读状态

export function initialPlanJob(subscriptionId: string = IDS.subscription) {
    const job = world.db.rows("coach_automation_jobs", (row) => row.idempotency_key === `initial_plan:${subscriptionId}`)[0];
    if (!job) throw new Error(`no initial_plan job for ${subscriptionId}`);
    return job;
}

export function intakeState(subscriptionId: string = IDS.subscription) {
    return initialPlanJob(subscriptionId).output_snapshot?.intake;
}

export function planInstance(subscriptionId: string = IDS.subscription) {
    const plan = world.db.rows("coach_plan_instances", (row) => row.coach_subscription_id === subscriptionId)[0];
    if (!plan) throw new Error(`no plan instance for ${subscriptionId}`);
    return plan;
}

/** 学员↔教练私聊里的消息，按时间排序。 */
export function roomMessages(a: string = IDS.student, b: string = IDS.coachUser) {
    const roomId = privateRoomId(a, b);
    return world.db.rows("chat_messages", (row) => row.room_id === roomId)
        .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
}

/** 教练账号发给学员的消息（计划通知、计划助理、AI 分身）。 */
export function coachToStudent() {
    return roomMessages().filter((row) => row.sender_id === IDS.coachUser);
}

/** 系统账号发给某个用户的通知。 */
export function systemNotices(userId: string = IDS.coachUser) {
    const rooms = new Set(world.db.rows("chat_rooms", (row) =>
        Array.isArray(row.members) && row.members.includes(IDS.admin) && row.members.includes(userId)).map((row) => row.id));
    return world.db.rows("chat_messages", (row) => rooms.has(row.room_id))
        .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
}

export function studentPrs() {
    return world.db.rows("personal_records_history", (row) => row.user_id === IDS.student);
}

export function studentProfile() {
    return world.db.rows("user_profiles", (row) => row.user_id === IDS.student)[0];
}

export function llmCalls(kind: string) {
    return world.llmCalls.filter((call) => call.kind === kind);
}

/** 执行记录里某个动作第一组的计划重量与强度。 */
export function plannedSet(execution: any, actionId: string) {
    const action = (execution?.action_executions || []).find((item: any) => item.action_id === actionId);
    const set = action?.sets?.[0];
    return { weight: set?.planned_weight ?? null, intensity: set?.planned_intensity ?? null };
}

/** get-instance 返回的计划里某天某动作的 load。 */
export function planLoad(instance: any, dayIndex: number, actionId: string) {
    const day = (instance?.training_days || []).find((d: any) => Number(d.dayIndex) === dayIndex);
    const set = (day?.actionSets || []).find((s: any) => s.actionId === actionId);
    return { load: set?.params?.load ?? null, text: set?.params?.loadDisplayText ?? null, source: set?.params?.loadSource ?? null };
}

/** 只启动队首的一个 after() 任务，不等它结束（用来制造“前一条还在处理”的时机）。 */
export function startNextAfterTask(): Promise<unknown> {
    const task = world.afterQueue.shift();
    if (!task) throw new Error("no after() task queued");
    return Promise.resolve().then(task);
}

export async function waitUntil(condition: () => boolean, label = "condition") {
    for (let i = 0; i < 2000; i++) {
        if (condition()) return;
        await new Promise((resolve) => setImmediate(resolve));
    }
    throw new Error(`timed out waiting for ${label}`);
}

/** 一次性闸门：大模型调用会停在 wait() 上，直到测试调用 open()。 */
export function createGate() {
    let open: () => void = () => undefined;
    const opened = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { wait: () => opened, open: () => open() };
}

/** 学员某条消息之后、下一条学员消息之前，教练账号发出的消息（计划助理确认或 AI 分身）。 */
export function repliesTo(messageId: string) {
    const messages = roomMessages();
    const index = messages.findIndex((row) => row.id === messageId);
    if (index < 0) throw new Error(`message ${messageId} not found`);
    const replies: FakeRow[] = [];
    for (const row of messages.slice(index + 1)) {
        if (row.sender_id === IDS.student) break;
        replies.push(row);
    }
    return replies;
}

/** AI 分身（不是计划助理）发出的消息。 */
export function aiAutoReplies() {
    return coachToStudent().filter((row) => row.content_metadata?.coach_ai_auto_reply && !row.content_metadata?.kind);
}

export function advanceDays(days: number) {
    advanceClock(days * 24 * 3600 * 1000);
}

export function advanceMs(ms: number) {
    advanceClock(ms);
}

/** 调试用：HARNESS_DUMP=1 时把聊天记录和吞掉的报错打出来。 */
export function dumpWorld() {
    const name = (id: string) => (id === IDS.student ? "学员" : id === IDS.coachUser ? "教练" : id === IDS.admin ? "系统" : id);
    const lines = world.db.rows("chat_messages")
        .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
        .map((m) => {
            const kind = m.content_metadata?.kind || (m.content_metadata?.coach_ai_auto_reply ? "ai" : "");
            return `${m.created_at} ${name(m.sender_id)} [${kind}] ${String(m.content).replace(/\n/g, " / ")}`;
        });
    const errors = world.errors.map((args) =>
        args.map((x) => (x instanceof Error ? x.message : typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    process.stdout.write(`\n----- chat -----\n${lines.join("\n")}\n----- errors -----\n${errors.join("\n")}\n`);
}
