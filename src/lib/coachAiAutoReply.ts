import type OpenAI from "openai";
import supabase from "@/lib/supabaseClient";
import { selectCoachAiKnowledgeForPrompt, type CoachAiKnowledgeDocument } from "@/lib/coachAiKnowledge";
import { getCoachlinkCoachReplyLlm } from "@/lib/coachlinkLlm";

const MAX_RECENT_MESSAGES = 12;
const MAX_KNOWLEDGE_CHARS = 4000;
const MAX_RETRIEVED_KNOWLEDGE_CHARS = 9000;
const MAX_PROMPT_CHARS = 3000;
const MAX_RUNTIME_CONTEXT_CHARS = 9000;
const MAX_PLAN_DAYS_IN_CONTEXT = 5;
const MAX_RECENT_CONTEXT_MESSAGES = 8;
const MAX_RECENT_CONTEXT_MESSAGE_CHARS = 300;

type ChatRoomRow = {
    id: string;
    members: string[] | null;
};

type CoachAiSetting = {
    coach_user_id: string;
    enabled: boolean;
    system_prompt: string | null;
    knowledge_base: string | null;
    knowledge_documents?: CoachAiKnowledgeDocument[] | null;
    model: string | null;
};

type RecentMessage = {
    sender_id: string;
    content: string | null;
    message_type: string;
    created_at: string | null;
    content_metadata?: any;
};

type CoachContext = {
    coachUserId: string;
    coachId: string;
    coachProfile: any;
};

type RuntimeReplyContext = {
    coach: any | null;
    studentProfile: any | null;
    subscription: any | null;
    planInstance: any | null;
    completedDayIndexes: number[];
    actionNameMap: Map<string, string>;
};

function trimForPrompt(value: string | null | undefined, max: number) {
    const text = (value || "").trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max)}\n...（后续资料已截断）`;
}

async function resolveCoachContext(room: ChatRoomRow, senderUserId: string): Promise<CoachContext | null> {
    const memberIds = (room.members || []).filter(Boolean);
    if (memberIds.length !== 2 || !memberIds.includes(senderUserId)) return null;

    const peerUserId = memberIds.find((id) => id !== senderUserId);
    if (!peerUserId) return null;

    const { data: coachRow, error } = await supabase
        .from("coaches")
        .select("id, user_id, name, title, bio, specialties, coach_track, service_modes, target_student_levels, support_focus, years_experience, profile")
        .eq("user_id", peerUserId)
        .maybeSingle();

    if (error || !coachRow?.user_id || !coachRow?.id) return null;
    return {
        coachUserId: coachRow.user_id as string,
        coachId: coachRow.id as string,
        coachProfile: coachRow,
    };
}

async function loadSetting(coachUserId: string): Promise<CoachAiSetting | null> {
    const withDocs = await supabase
        .from("coach_ai_auto_reply_settings" as any)
        .select("coach_user_id, enabled, system_prompt, knowledge_base, knowledge_documents, model")
        .eq("coach_user_id", coachUserId)
        .maybeSingle();

    if (!withDocs.error) {
        return withDocs.data as unknown as CoachAiSetting | null;
    }

    const message = String(withDocs.error?.message || "");
    if (message.includes("knowledge_documents") || message.includes("schema cache")) {
        const legacy = await supabase
            .from("coach_ai_auto_reply_settings" as any)
            .select("coach_user_id, enabled, system_prompt, knowledge_base, model")
            .eq("coach_user_id", coachUserId)
            .maybeSingle();

        if (!legacy.error) {
            return legacy.data as unknown as CoachAiSetting | null;
        }

        console.error("[coach-ai-auto-reply] load legacy setting failed:", legacy.error);
        return null;
    }

    const error = withDocs.error;
    if (error) {
        console.error("[coach-ai-auto-reply] load setting failed:", error);
        return null;
    }

    return null;
}

async function loadRecentMessages(roomId: string): Promise<RecentMessage[]> {
    const { data, error } = await supabase
        .from("chat_messages")
        .select("sender_id, content, message_type, created_at, content_metadata")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(MAX_RECENT_MESSAGES);

    if (error) {
        console.error("[coach-ai-auto-reply] load recent messages failed:", error);
        return [];
    }

    return [...((data || []) as RecentMessage[])].reverse();
}

function compactJson(value: unknown, max = 1200) {
    if (!value) return "";
    try {
        const text = JSON.stringify(value);
        return text.length > max ? `${text.slice(0, max)}...` : text;
    } catch {
        return "";
    }
}

function compactLines(lines: Array<string | null | undefined>) {
    return lines.filter((line): line is string => Boolean(line && line.trim()));
}

function normalizeTrainingDays(raw: unknown): any[] {
    return Array.isArray(raw) ? raw : [];
}

function getDayIndex(day: any, fallback: number) {
    return Number(day?.dayIndex ?? day?.day_index ?? fallback);
}

function getActionIdFromSet(set: any): string | null {
    return String(set?.actionId || set?.action_id || "").trim() || null;
}

function collectActionIdsFromDays(days: any[]) {
    const ids = new Set<string>();

    const visitSet = (set: any) => {
        const id = getActionIdFromSet(set);
        if (id) ids.add(id);
        if (Array.isArray(set?.actions)) {
            set.actions.forEach(visitSet);
        }
    };

    for (const day of days) {
        const sets = Array.isArray(day?.actionSets) ? day.actionSets : [];
        sets.forEach(visitSet);
    }

    return Array.from(ids);
}

async function loadActionNameMap(days: any[]) {
    const ids = collectActionIdsFromDays(days);
    const map = new Map<string, string>();
    if (ids.length === 0) return map;

    const addRows = (rows: any[] | null | undefined) => {
        for (const row of rows || []) {
            if (row?.id && row?.name) map.set(String(row.id), String(row.name));
        }
    };

    const [coachActions, studentActions] = await Promise.allSettled([
        supabase.from("coach_actions").select("id, name").in("id", ids),
        supabase.from("student_actions").select("id, name").in("id", ids),
    ]);

    if (coachActions.status === "fulfilled" && !coachActions.value.error) {
        addRows(coachActions.value.data as any[]);
    }
    if (studentActions.status === "fulfilled" && !studentActions.value.error) {
        addRows(studentActions.value.data as any[]);
    }

    return map;
}

async function loadRuntimeReplyContext(params: {
    coach: CoachContext;
    studentUserId: string;
}): Promise<RuntimeReplyContext> {
    const [studentProfileRes, subscriptionRes] = await Promise.allSettled([
        supabase
            .from("user_profiles")
            .select("nickname, full_name, gender, age, height, weight, fitness_goal, fitness_level, lifestyle, sport_cards")
            .eq("user_id", params.studentUserId)
            .maybeSingle(),
        supabase
            .from("coach_subscriptions")
            .select("id, student_id, coach_id, tier, status, start_date, end_date, subscribed_weeks, subscribe_data, updated_at")
            .eq("coach_id", params.coach.coachId)
            .eq("student_id", params.studentUserId)
            .in("status", ["active", "pending_renew", "paused"])
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const studentProfile = studentProfileRes.status === "fulfilled" && !studentProfileRes.value.error
        ? studentProfileRes.value.data
        : null;
    const subscription = subscriptionRes.status === "fulfilled" && !subscriptionRes.value.error
        ? subscriptionRes.value.data
        : null;

    let planInstance: any = null;
    let completedDayIndexes: number[] = [];
    let actionNameMap = new Map<string, string>();

    if (subscription?.id) {
        const { data: plan } = await supabase
            .from("coach_plan_instances")
            .select("id, name, description, status, start_execution_day, training_days, training_days_count, rest_days_count, updated_at")
            .eq("coach_subscription_id", subscription.id)
            .in("status", ["active", "paused", "completed"])
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        planInstance = plan || null;

        if (planInstance?.id) {
            const { data: executions } = await supabase
                .from("plan_instance_executions")
                .select("day_index, status")
                .eq("instance_id", planInstance.id)
                .eq("status", "completed");

            completedDayIndexes = (executions || [])
                .map((e: any) => Number(e.day_index || 0))
                .filter((n) => n > 0);
        }

        actionNameMap = await loadActionNameMap(normalizeTrainingDays(planInstance?.training_days));
    }

    return {
        coach: params.coach.coachProfile,
        studentProfile,
        subscription,
        planInstance,
        completedDayIndexes,
        actionNameMap,
    };
}

function summarizeActionSet(set: any, actionNameMap: Map<string, string>): string {
    if (set?.type === "one-filter") {
        const question = set?.question?.question || "条件分支";
        const branches = Array.isArray(set?.actions)
            ? set.actions.slice(0, 3).map((branch: any, index: number) => {
                const option = set?.question?.options?.[index] || `分支${index + 1}`;
                return `${option}: ${summarizeActionSet(branch, actionNameMap)}`;
            })
            : [];
        return `${question}（${branches.join("；")}）`;
    }

    const actionId = getActionIdFromSet(set);
    const actionName =
        set?.actionName ||
        set?.action_name ||
        set?.name ||
        set?.setName ||
        set?.params?.custom_data?.habit_name ||
        (actionId ? actionNameMap.get(actionId) : null) ||
        "未命名训练项";
    const params = set?.params || {};
    const pieces = compactLines([
        params.sets ? `${params.sets}组` : null,
        params.reps ? `${params.reps}次` : null,
        params.rm ? `${params.rm}RM` : null,
        params.load ? `${params.load}kg` : null,
        params.restSeconds || params.rest_seconds ? `休息${params.restSeconds || params.rest_seconds}秒` : null,
        params.note || set?.note ? `备注:${params.note || set.note}` : null,
    ]);

    return pieces.length > 0 ? `${actionName}（${pieces.join("，")}）` : String(actionName);
}

function summarizePlanDays(planInstance: any, completedDayIndexes: number[], actionNameMap: Map<string, string>) {
    const days = normalizeTrainingDays(planInstance?.training_days);
    if (days.length === 0) return "暂无当前计划明细。";

    const completed = new Set(completedDayIndexes);
    const startExecutionDay = Number(planInstance?.start_execution_day || 1);
    const trainingDays = days
        .filter((day: any, index) => getDayIndex(day, index + 1) >= startExecutionDay)
        .filter((day: any) => day?.type === "training");
    const nextDays = trainingDays
        .filter((day: any, index) => !completed.has(getDayIndex(day, index + 1)))
        .slice(0, MAX_PLAN_DAYS_IN_CONTEXT);

    const total = trainingDays.length;
    const completedCount = trainingDays.filter((day: any, index) => completed.has(getDayIndex(day, index + 1))).length;

    const dayLines = nextDays.map((day: any, index) => {
        const dayIndex = getDayIndex(day, index + 1);
        const sets = Array.isArray(day?.actionSets) ? day.actionSets : [];
        const actions = sets.slice(0, 6).map((set: any) => summarizeActionSet(set, actionNameMap));
        const note = day?.note ? `；备注：${day.note}` : "";
        return `- 第${dayIndex}天：${actions.join("；") || "未配置动作"}${note}`;
    });

    return compactLines([
        `计划进度：已完成 ${completedCount}/${total} 个训练日。`,
        dayLines.length > 0
            ? `接下来可参考的训练日：\n${dayLines.join("\n")}`
            : "当前计划已没有未完成训练日或暂无可识别训练日。",
    ]).join("\n");
}

function buildRuntimeContextText(ctx: RuntimeReplyContext) {
    const coach = ctx.coach || {};
    const profile = (coach.profile || {}) as any;
    const student = ctx.studentProfile || {};
    const subscription = ctx.subscription || {};
    const plan = ctx.planInstance || {};

    const text = compactLines([
        "【系统可用资料】",
        "以下是系统从 CoachLink 中读取到的上下文。AI 必须优先依据这些资料和教练资料库回答；资料没有覆盖的内容，不要猜测。",
        "",
        "【教练资料】",
        compactLines([
            coach.name ? `姓名：${coach.name}` : null,
            coach.title ? `头衔：${coach.title}` : null,
            coach.years_experience ? `经验：${coach.years_experience}年` : null,
            coach.specialties?.length ? `专项：${coach.specialties.join("、")}` : null,
            coach.support_focus ? `支持重点：${coach.support_focus}` : null,
            profile.teachingPhilosophy ? `教学理念：${profile.teachingPhilosophy}` : null,
            coach.bio ? `简介：${coach.bio}` : null,
        ]).join("\n"),
        "",
        "【学员资料】",
        compactLines([
            student.nickname || student.full_name ? `昵称/姓名：${student.nickname || student.full_name}` : null,
            student.gender ? `性别：${student.gender}` : null,
            student.age ? `年龄：${student.age}` : null,
            student.height ? `身高：${student.height}cm` : null,
            student.weight ? `体重：${student.weight}kg` : null,
            student.fitness_level ? `训练水平：${student.fitness_level}` : null,
            student.fitness_goal ? `训练目标：${student.fitness_goal}` : null,
            student.lifestyle ? `生活作息：${student.lifestyle}` : null,
            student.sport_cards ? `运动数据卡：${compactJson(student.sport_cards, 900)}` : null,
        ]).join("\n") || "暂无学员档案。",
        "",
        "【订阅关系】",
        subscription.id
            ? compactLines([
                `订阅状态：${subscription.status || "-"}`,
                subscription.tier ? `订阅档位：${subscription.tier}` : null,
                subscription.subscribed_weeks ? `购买周期：${subscription.subscribed_weeks}周` : null,
                subscription.start_date ? `开始日期：${subscription.start_date}` : null,
                subscription.end_date ? `预计结束/生命周期日期：${subscription.end_date}` : null,
                subscription.subscribe_data ? `订阅补充资料：${compactJson(subscription.subscribe_data, 1200)}` : null,
            ]).join("\n")
            : "暂无活跃订阅关系。",
        "",
        "【当前计划摘要】",
        plan.id
            ? compactLines([
                `计划名称：${plan.name || "-"}`,
                `计划状态：${plan.status || "-"}`,
                plan.description ? `计划说明：${plan.description}` : null,
                summarizePlanDays(plan, ctx.completedDayIndexes, ctx.actionNameMap),
            ]).join("\n")
            : "暂无当前计划。",
    ]).join("\n");

    return trimForPrompt(text, MAX_RUNTIME_CONTEXT_CHARS);
}

function buildRecentConversationContext(params: {
    recentMessages: RecentMessage[];
    coachUserId: string;
    latestUserMessage: string;
}) {
    const latest = params.latestUserMessage.trim();
    const messages = [...params.recentMessages];
    const latestIndex = messages
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(({ message }) => (
            message.sender_id !== params.coachUserId &&
            message.message_type === "text" &&
            (message.content || "").trim() === latest
        ))?.index;

    if (typeof latestIndex === "number") {
        messages.splice(latestIndex, 1);
    }

    const lines = messages
        .filter((message) => message.message_type === "text" && (message.content || "").trim())
        .slice(-MAX_RECENT_CONTEXT_MESSAGES)
        .map((message) => {
            const speaker = message.content_metadata?.coach_ai_auto_reply
                ? "AI分身已回复"
                : message.sender_id === params.coachUserId
                    ? "教练"
                    : "学员";
            return `- ${speaker}: ${trimForPrompt(message.content, MAX_RECENT_CONTEXT_MESSAGE_CHARS)}`;
        });

    return lines.join("\n");
}

function buildSystemPrompt(params: {
    setting: CoachAiSetting;
    runtimeContext: RuntimeReplyContext;
    latestUserMessage: string;
    recentMessages: RecentMessage[];
    coachUserId: string;
}) {
    const { setting, runtimeContext, latestUserMessage } = params;
    const coachPrompt = trimForPrompt(setting.system_prompt, MAX_PROMPT_CHARS);
    const knowledge = trimForPrompt(setting.knowledge_base, MAX_KNOWLEDGE_CHARS);
    const retrievedKnowledge = selectCoachAiKnowledgeForPrompt({
        documents: setting.knowledge_documents,
        queryText: latestUserMessage,
        maxChars: MAX_RETRIEVED_KNOWLEDGE_CHARS,
        maxDocuments: 7,
    });
    const runtime = buildRuntimeContextText(runtimeContext);
    const recentContext = buildRecentConversationContext({
        recentMessages: params.recentMessages,
        coachUserId: params.coachUserId,
        latestUserMessage,
    });

    const prompt = [
        "你是 CoachLink 上某位真人教练授权的 AI 虚拟分身，负责在教练未及时回复时给学员做基础沟通。",
        "你的回复必须使用中文，语气专业、温和、简洁，像教练的助理，而不是替教练做不可逆承诺。",
        "你不是通用聊天机器人。你只能基于【系统可用资料】、【教练资料库】、最近聊天上下文和【当前学员消息】回答。",
        "必须遵守：",
        "1. 不冒充真人教练本人，不说“我是你的教练本人”。",
        "2. 遇到疼痛、受伤、疾病、用药、诊断等高风险问题，建议停止相关动作并联系真人教练或医生。",
        "3. 不擅自修改训练计划、价格、预约、退款等承诺，只能给原则性建议并提示等待教练确认。",
        "4. 如果系统资料、教练资料库和聊天上下文没有足够依据，直接说明需要教练进一步确认，不要凭感觉编造。",
        "5. 回答训练安排时，必须优先参考当前计划摘要；没有计划依据时，只能给非常泛化的安全建议。",
        "6. 你只需要回复【当前学员消息】。最近聊天上下文只用于理解背景，不要逐条复盘，不要重复回答已经回复过的历史训练反馈或历史问题，除非当前消息明确追问。",
        runtime ? `\n${runtime}` : "",
        recentContext ? `\n最近聊天上下文（仅用于理解背景，禁止逐条重复回答）：\n${recentContext}` : "",
        coachPrompt ? `\n教练设定的基础提示词：\n${coachPrompt}` : "",
        knowledge ? `\n教练核心补充资料（始终参考）：\n${knowledge}` : "",
        retrievedKnowledge.contextText
            ? `\n按当前问题检索命中的教练知识文档（优先参考）：\n${retrievedKnowledge.contextText}`
            : "",
    ].filter(Boolean).join("\n");

    return {
        prompt,
        selectedKnowledgeDocs: retrievedKnowledge.selectedTitles,
    };
}

async function generateReply(params: {
    setting: CoachAiSetting;
    coachUserId: string;
    latestSenderUserId: string;
    latestUserMessage: string;
    recentMessages: RecentMessage[];
    runtimeContext: RuntimeReplyContext;
}) {
    const { client, model: defaultModel } = getCoachlinkCoachReplyLlm();
    const configuredModel = params.setting.model?.trim();
    // 旧设置保存的是 DeepSeek/Ofox/Gemini 模型名，迁移后不能继续拿它请求万界方舟。
    const model = configuredModel && !/^(deepseek|gemini|google\/)/i.test(configuredModel)
        ? configuredModel
        : defaultModel;
    const systemPrompt = buildSystemPrompt({
        setting: params.setting,
        runtimeContext: params.runtimeContext,
        latestUserMessage: params.latestUserMessage,
        recentMessages: params.recentMessages,
        coachUserId: params.coachUserId,
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: systemPrompt.prompt,
        },
        {
            role: "user",
            content: `当前学员消息：\n${params.latestUserMessage}`,
        },
    ];

    const completion = await client.chat.completions.create({
        model,
        messages,
        stream: false,
        temperature: 0.4,
        max_tokens: 700,
    });

    return {
        content: completion.choices[0]?.message?.content?.trim() || "",
        model,
        selectedKnowledgeDocs: systemPrompt.selectedKnowledgeDocs,
    };
}

async function insertAiReply(params: {
    room: ChatRoomRow;
    coachUserId: string;
    studentUserId: string;
    content: string;
    model: string;
    selectedKnowledgeDocs: string[];
}) {
    const now = new Date().toISOString();
    const content = params.content.trim();

    const { data: inserted, error: insertError } = await supabase
        .from("chat_messages")
        .insert({
            room_id: params.room.id,
            sender_id: params.coachUserId,
            message_type: "text",
            content,
            created_at: now,
            content_metadata: {
                coach_ai_auto_reply: true,
                virtual_avatar_label: "教练虚拟分身",
                provider: "wanjie-ark",
                model: params.model,
                reply_scope: "latest_user_message",
                selected_knowledge_docs: params.selectedKnowledgeDocs,
            },
        } as any)
        .select("id")
        .single();

    if (insertError || !inserted?.id) {
        throw new Error(insertError?.message || "插入 AI 回复失败");
    }

    const { error: updateError } = await supabase
        .from("chat_rooms")
        .update({
            last_message: content,
            last_message_at: now,
            unread_members: [params.studentUserId],
            updated_at: now,
        })
        .eq("id", params.room.id);

    if (updateError) {
        throw new Error(updateError.message);
    }
}

export async function maybeCreateCoachAiAutoReply(params: {
    room: ChatRoomRow;
    senderUserId: string;
    messageType: string;
    content: string;
}) {
    if (params.messageType !== "text" || !params.content.trim()) return;

    const coach = await resolveCoachContext(params.room, params.senderUserId);
    if (!coach) return;

    const setting = await loadSetting(coach.coachUserId);
    if (!setting?.enabled) return;

    try {
        const [recentMessages, runtimeContext] = await Promise.all([
            loadRecentMessages(params.room.id),
            loadRuntimeReplyContext({
                coach,
                studentUserId: params.senderUserId,
            }),
        ]);
        const reply = await generateReply({
            setting,
            coachUserId: coach.coachUserId,
            latestSenderUserId: params.senderUserId,
            latestUserMessage: params.content.trim(),
            recentMessages,
            runtimeContext,
        });

        if (!reply.content) return;

        await insertAiReply({
            room: params.room,
            coachUserId: coach.coachUserId,
            studentUserId: params.senderUserId,
            content: reply.content,
            model: reply.model,
            selectedKnowledgeDocs: reply.selectedKnowledgeDocs,
        });
    } catch (error) {
        console.error("[coach-ai-auto-reply] failed:", error);
    }
}
