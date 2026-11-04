/**
 * 首个计划「计划助理」：计划生成后私信学员确认缺失的 1RM / 体重 / 疑问，
 * 学员回复后把数字记进 PR 历史（之后训练按新 1RM 自动算重量），其余信息转告教练。
 *
 * 状态存在 initial_plan 任务的 output_snapshot.intake 里，不需要新表。
 */
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";
import { toBeijingDateKey } from "@/lib/beijingTime";
import { sendDirectMessage, sendSystemMessage } from "@/lib/chat";
import { getCoachlinkFastLlm } from "@/lib/coachlinkLlm";
import { parseJsonResponse } from "@/lib/deepseek";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { draftPlanRevisionFromIntake } from "./planIntakeRevision";
import { buildProfileOneRmInputs, resolveProfileBodyWeight } from "./profileOneRm";
import {
    INTAKE_REPLY_WINDOW_DAYS,
    MAX_FOLLOW_UPS,
    buildCoachNotice,
    buildIntakeQuestions,
    buildIntakeReplyPrompt,
    buildStudentConfirmation,
    estimateOneRmFromAnswer,
    findMissingPlanInputs,
    formatIntakeQuestionMessage,
    normalizeIntakeReply,
    type PlanActionInfo,
    type PlanIntakeHeldAnswer,
    type PlanIntakeQuestion,
    type PlanIntakeRecord,
    type PlanIntakeState,
} from "./planIntakeModel";
import type { AutomationContext } from "./types";

const INTAKE_MESSAGE_KIND = "plan_intake_questions";
const INTAKE_REPLY_KIND = "plan_intake_reply";
const ASSISTANT_LABEL = "教练计划助理";
const PROCESSING_LEASE_MS = 2 * 60 * 1000;
const REPLY_LLM_TIMEOUT_MS = 20_000;
const MAX_STUDENT_MESSAGES_FOR_REPLY = 10;

const db = () => serviceRoleSupabase as any;

function emptyState(planInstanceId: string, status: PlanIntakeState["status"]): PlanIntakeState {
    return {
        version: 1,
        status,
        planInstanceId,
        askedAt: null,
        questions: [],
        pendingQuestionIds: [],
        answeredQuestionIds: [],
        unknownQuestionIds: [],
        heldAnswers: [],
        followUpsSent: 0,
        lastProcessedMessageAt: null,
        recorded: [],
        notes: [],
        riskNotes: [],
    };
}

function assistantMetadata(kind: string, extra: Record<string, unknown>) {
    return {
        kind,
        coach_ai_auto_reply: true,
        virtual_avatar_label: ASSISTANT_LABEL,
        ai_generated: true,
        ...extra,
    };
}

// 训练开始和计划页只读 user_profiles.weight（不看健美卡体重）。这里按同一口径判断，
// 否则学员只填了健美卡体重时不会被问体重，负重类动作在训练时仍算不出重量。
function runtimeBodyWeight(profile: any): number | null {
    return resolveProfileBodyWeight({ weight: profile?.weight });
}

function displayName(profile: any): string {
    return String(profile?.nickname || profile?.full_name || "").trim() || "学员";
}

async function loadPlanActions(trainingDays: any[]): Promise<Map<string, PlanActionInfo>> {
    const ids = new Set<string>();
    for (const day of trainingDays || []) {
        for (const set of Array.isArray(day?.actionSets) ? day.actionSets : []) {
            const id = String(set?.actionId || set?.action_id || "").trim();
            if (id) ids.add(id);
        }
    }
    const map = new Map<string, PlanActionInfo>();
    if (ids.size === 0) return map;

    const { data, error } = await db()
        .from("coach_actions")
        .select('id, name, canonical_action_id, type, "includesBodyWeight"')
        .in("id", Array.from(ids));
    if (error) throw new Error(`读取计划动作失败: ${error.message}`);
    for (const row of data || []) {
        map.set(String(row.id), {
            id: String(row.id),
            name: String(row.name || "").trim(),
            canonicalActionId: row.canonical_action_id || null,
            includesBodyWeight: row.includesBodyWeight === true,
            type: row.type || null,
        });
    }
    return map;
}

async function collectKnownOneRmKeys(params: {
    context: AutomationContext;
    subscribeData: any;
    sportCards: any;
    actions: Map<string, PlanActionInfo>;
}): Promise<Set<string>> {
    const keys = new Set<string>();
    const add = (value: unknown) => {
        const text = String(value || "").trim();
        if (text) keys.add(text);
    };

    const records = await getCurrent1RMRecords(params.context.coachUserId || params.context.coachId, {
        targetUserId: params.context.studentId,
    });
    for (const record of records || []) {
        if (!(Number(record.current1RM) > 0)) continue;
        add(record.actionId);
        add(record.actionName);
        add(record.canonicalActionId);
    }

    const rmItem = Array.isArray(params.subscribeData)
        ? params.subscribeData.find((item: any) => item?.type === "rm")
        : null;
    for (const [key, value] of Object.entries(rmItem?.userInputs || {})) {
        if (Number(value) > 0) add(key);
    }

    const profileInputs = buildProfileOneRmInputs(
        params.sportCards,
        Array.from(params.actions.values()).map((a) => ({
            id: a.id,
            name: a.name,
            canonical_action_id: a.canonicalActionId,
        })),
    );
    Object.keys(profileInputs).forEach(add);
    return keys;
}

/**
 * 首个计划生成后调用。返回要写进任务 output_snapshot.intake 的状态；失败不影响计划本身。
 */
export async function startPlanIntake(params: {
    context: AutomationContext;
    planInstanceId: string;
    planPublished: boolean;
}): Promise<PlanIntakeState> {
    const { context, planInstanceId } = params;
    if (!context.coachUserId) return { ...emptyState(planInstanceId, "failed"), error: "coach_user_missing" };

    const [{ data: plan, error: planError }, { data: profile }, { data: coach }, { data: subscription }] =
        await Promise.all([
            db().from("coach_plan_instances")
                .select("id, training_days, start_execution_day, ai_generation_log")
                .eq("id", planInstanceId)
                .single(),
            db().from("user_profiles")
                .select("nickname, full_name, weight, sport_cards")
                .eq("user_id", context.studentId)
                .maybeSingle(),
            db().from("coaches").select("name").eq("id", context.coachId).maybeSingle(),
            db().from("coach_subscriptions").select("subscribe_data").eq("id", context.subscriptionId).maybeSingle(),
        ]);
    if (planError || !plan) throw new Error(planError?.message || "plan_instance_not_found");

    const trainingDays = Array.isArray(plan.training_days) ? plan.training_days : [];
    const actions = await loadPlanActions(trainingDays);
    const oneRmKeys = await collectKnownOneRmKeys({
        context,
        subscribeData: subscription?.subscribe_data,
        sportCards: profile?.sport_cards,
        actions,
    });
    const bodyWeight = runtimeBodyWeight(profile);

    const { missingOneRm, needsBodyWeight } = findMissingPlanInputs({
        trainingDays,
        startExecutionDay: plan.start_execution_day,
        actions,
        oneRmKeys,
        bodyWeight,
    });
    const openQuestions = Array.isArray(plan.ai_generation_log?.stageB?.openQuestions)
        ? plan.ai_generation_log.stageB.openQuestions
        : [];
    const questions = buildIntakeQuestions({ missingOneRm, needsBodyWeight, openQuestions });
    if (questions.length === 0) return emptyState(planInstanceId, "not_needed");

    const content = formatIntakeQuestionMessage({
        studentName: displayName(profile),
        coachName: String(coach?.name || "").trim(),
        planPublished: params.planPublished,
        questions,
    });
    const askedAt = new Date().toISOString();
    const sent = await sendDirectMessage({
        fromUserId: context.coachUserId,
        toUserId: context.studentId,
        content,
        contentMetadata: assistantMetadata(INTAKE_MESSAGE_KIND, {
            plan_instance_id: planInstanceId,
            question_ids: questions.map((q) => q.id),
        }),
    });
    if (!sent) return { ...emptyState(planInstanceId, "failed"), questions, error: "send_direct_message_failed" };

    return {
        ...emptyState(planInstanceId, "awaiting_reply"),
        askedAt,
        questions,
        pendingQuestionIds: questions.map((q) => q.id),
        lastProcessedMessageAt: askedAt,
    };
}

/** 计划助理私信只是补充信息，出错不能让生成计划的任务失败。 */
export async function startPlanIntakeSafely(params: {
    context: AutomationContext;
    planInstanceId: string;
    planPublished: boolean;
}): Promise<PlanIntakeState> {
    try {
        return await startPlanIntake(params);
    } catch (error) {
        console.error(`[plan-intake] start failed (planInstanceId=${params.planInstanceId}):`, error);
        return {
            ...emptyState(params.planInstanceId, "failed"),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

type IntakeJob = {
    id: string;
    updated_at: string;
    output_snapshot: Record<string, any> | null;
    plan_instance_id: string | null;
    subscription_id: string | null;
};

async function findAwaitingIntakeJob(coachId: string, studentId: string): Promise<IntakeJob | null> {
    const { data, error } = await db()
        .from("coach_automation_jobs")
        .select("id, updated_at, output_snapshot, plan_instance_id, subscription_id")
        // 首个计划和自动发布的下一阶段计划都会私信学员
        .in("type", ["initial_plan", "next_phase"])
        .eq("coach_id", coachId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(5);
    if (error) {
        console.error("[plan-intake] load jobs failed:", error);
        return null;
    }
    return (data || []).find((job: IntakeJob) => job.output_snapshot?.intake?.status === "awaiting_reply") || null;
}

/** 以 updated_at 做乐观锁写回状态；被别的请求抢先时返回 null。 */
async function writeIntakeState(
    job: IntakeJob,
    intake: PlanIntakeState,
    extra: Record<string, unknown> = {},
): Promise<IntakeJob | null> {
    const now = new Date().toISOString();
    const outputSnapshot = { ...(job.output_snapshot || {}), intake };
    const { data, error } = await db()
        .from("coach_automation_jobs")
        .update({ output_snapshot: outputSnapshot, updated_at: now, ...extra })
        .eq("id", job.id)
        .eq("updated_at", job.updated_at)
        .select("id, updated_at, output_snapshot, plan_instance_id, subscription_id");
    if (error) {
        console.error("[plan-intake] write state failed:", error);
        return null;
    }
    return Array.isArray(data) && data.length > 0 ? (data[0] as IntakeJob) : null;
}

async function loadStudentMessagesSince(roomId: string, studentId: string, sinceIso: string | null) {
    let query = db()
        .from("chat_messages")
        .select("content, created_at")
        .eq("room_id", roomId)
        .eq("sender_id", studentId)
        .eq("message_type", "text")
        .order("created_at", { ascending: true })
        .limit(MAX_STUDENT_MESSAGES_FOR_REPLY);
    if (sinceIso) query = query.gt("created_at", sinceIso);
    const { data, error } = await query;
    if (error) throw new Error(`读取学员消息失败: ${error.message}`);
    return (data || []).filter((row: any) => String(row?.content || "").trim()) as Array<{
        content: string;
        created_at: string;
    }>;
}

async function extractReply(questions: PlanIntakeQuestion[], messages: string[]) {
    const { client, model } = getCoachlinkFastLlm();
    const completion = await client.chat.completions.create(
        {
            model,
            messages: [{ role: "user", content: buildIntakeReplyPrompt({ questions, studentMessages: messages }) }],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 800,
        } as any,
        { timeout: REPLY_LLM_TIMEOUT_MS },
    );
    const text = completion.choices?.[0]?.message?.content || "";
    if (!text) throw new Error("LLM 返回空内容");
    return normalizeIntakeReply(parseJsonResponse<any>(text, "plan-intake-reply"), questions);
}

async function insertSelfReportedRecords(params: {
    studentId: string;
    coachId: string;
    records: Array<PlanIntakeRecord & { includesBodyWeight: boolean; bodyWeight: number | null }>;
}) {
    if (params.records.length === 0) return;
    const today = toBeijingDateKey(new Date());
    const rows = params.records.map((record) => ({
        user_id: params.studentId,
        action_id: record.actionId || null,
        exercise_name: record.actionName,
        weight: record.weightKg,
        reps: record.reps,
        e1rm: record.e1rm,
        date_achieved: today,
        notes: "学员私信自报（计划助理记录）",
        is_auto_calculated: false,
        source_type: "coach",
        source_coach_id: params.coachId,
        estimated_from: {
            source: "plan_intake",
            weight: record.weightKg,
            reps: record.reps,
            bodyWeight: record.includesBodyWeight ? record.bodyWeight : undefined,
        },
    }));
    const { error } = await db().from("personal_records_history").insert(rows);
    if (error) throw new Error(`写入 1RM 记录失败: ${error.message}`);
}

/** 学员补充了文字信息时生成计划调整草稿；返回追加到教练通知里的一行，失败时降级为只通知。 */
async function draftRevisionLine(params: {
    job: IntakeJob;
    coachId: string;
    coachUserId: string;
    studentId: string;
    planInstanceId: string;
    notes: string[];
    riskNotes: string[];
}): Promise<string | null> {
    if (params.notes.length === 0 && params.riskNotes.length === 0) return null;
    if (!params.job.subscription_id) return null;
    try {
        const result = await draftPlanRevisionFromIntake({
            planInstanceId: params.planInstanceId,
            subscriptionId: params.job.subscription_id,
            coachId: params.coachId,
            coachUserId: params.coachUserId,
            studentId: params.studentId,
            intakeJobId: params.job.id,
            notes: params.notes,
            riskNotes: params.riskNotes,
        });
        if (result.status !== "drafted") return null;
        return `已按这些信息生成计划调整草稿（${result.summary}），只改学员还没练的天。请到 [自动化](/dashboard/automation) 确认后应用。`;
    } catch (error) {
        console.error("[plan-intake] draft plan revision failed:", error);
        return null;
    }
}

type IntakeRoom = {
    roomMembers: string[];
    senderUserId: string;
    messageType: string;
    content: string;
};

/** 房间是学员↔教练一对一时，返回教练身份；教练发出的消息和群聊返回 null。 */
async function resolveIntakeCoach(params: IntakeRoom): Promise<{ coachId: string; coachUserId: string } | null> {
    if (params.messageType !== "text" || !params.content.trim()) return null;
    const members = (params.roomMembers || []).filter(Boolean);
    if (members.length !== 2 || !members.includes(params.senderUserId)) return null;
    const peerUserId = members.find((id) => id !== params.senderUserId);
    if (!peerUserId) return null;

    const { data: coach } = await db().from("coaches").select("id, user_id").eq("user_id", peerUserId).maybeSingle();
    return coach?.id ? { coachId: String(coach.id), coachUserId: peerUserId } : null;
}

function isExpired(intake: PlanIntakeState, nowMs: number): boolean {
    const askedMs = intake.askedAt ? new Date(intake.askedAt).getTime() : 0;
    return !askedMs || nowMs - askedMs > INTAKE_REPLY_WINDOW_DAYS * 24 * 3600 * 1000;
}

/**
 * send-message 用来决定要不要把这条消息交给计划助理（放到响应之后处理，避免拖慢发送）。
 * 只做两次轻量查询，不调用模型。
 */
export async function hasAwaitingPlanIntake(params: IntakeRoom): Promise<boolean> {
    const coach = await resolveIntakeCoach(params);
    if (!coach) return false;
    const job = await findAwaitingIntakeJob(coach.coachId, params.senderUserId);
    return Boolean(job && !isExpired(job.output_snapshot?.intake as PlanIntakeState, Date.now()));
}

/**
 * 学员发出文字消息后调用。处理了这条回复返回 handled=true，调用方就不再触发 AI 自动回复，
 * 避免学员收到两条。学员分几条连着发时，后到的消息在前一条处理期间也算已处理，
 * 处理完会再看一遍有没有新消息。
 */
export async function handlePlanIntakeReply(params: IntakeRoom & {
    roomId: string;
    messageId: string;
}): Promise<{ handled: boolean }> {
    const coach = await resolveIntakeCoach(params);
    if (!coach) return { handled: false };

    let handled = false;
    for (let pass = 0; pass < 2; pass++) {
        const job = await findAwaitingIntakeJob(coach.coachId, params.senderUserId);
        if (!job) return { handled };
        const intake = job.output_snapshot?.intake as PlanIntakeState;

        const nowMs = Date.now();
        if (isExpired(intake, nowMs)) {
            await writeIntakeState(job, { ...intake, status: "expired", closedAt: new Date().toISOString(), processing: null });
            return { handled };
        }
        const leaseMs = intake.processing?.at ? nowMs - new Date(intake.processing.at).getTime() : Infinity;
        if (intake.processing && leaseMs < PROCESSING_LEASE_MS) return { handled: true };

        const claimed = await writeIntakeState(job, {
            ...intake,
            processing: { messageId: params.messageId, at: new Date().toISOString() },
        });
        if (!claimed) return { handled: true };

        let result: { handled: boolean; hasNewerMessages: boolean };
        try {
            result = await processClaimedReply({
                job: claimed,
                intake,
                coachId: coach.coachId,
                coachUserId: coach.coachUserId,
                roomId: params.roomId,
                studentId: params.senderUserId,
            });
        } catch (error) {
            console.error("[plan-intake] handle reply failed:", error);
            await writeIntakeState(claimed, { ...intake, processing: null }).catch(() => undefined);
            return { handled };
        }
        handled = handled || result.handled;
        if (!result.hasNewerMessages) break;
    }
    return { handled };
}

type ResolvedAnswers = {
    records: PlanIntakeRecord[];
    uncalibrated: PlanIntakeRecord[];
    held: PlanIntakeHeldAnswer[];
};

function resolveOneRmAnswers(params: {
    answers: PlanIntakeHeldAnswer[];
    questionById: Map<string, PlanIntakeQuestion>;
    bodyWeight: number | null;
    bodyWeightUnavailable: boolean;
}): ResolvedAnswers {
    const resolved: ResolvedAnswers = { records: [], uncalibrated: [], held: [] };
    for (const answer of params.answers) {
        const question = params.questionById.get(answer.questionId);
        if (!question || question.kind !== "one_rm") continue;
        const base: PlanIntakeRecord = {
            questionId: question.id,
            actionId: question.actionId,
            actionName: question.actionName,
            weightKg: answer.weightKg,
            reps: answer.reps,
        };
        const estimate = estimateOneRmFromAnswer({
            weightKg: answer.weightKg,
            reps: answer.reps,
            includesBodyWeight: question.includesBodyWeight,
            bodyWeight: params.bodyWeight,
        });
        if (estimate.status === "ok") {
            resolved.records.push({ ...base, e1rm: estimate.e1rm });
        } else if (estimate.status === "not_estimable") {
            resolved.uncalibrated.push({ ...base, uncalibratedReason: estimate.reason });
        } else if (params.bodyWeightUnavailable) {
            resolved.uncalibrated.push({ ...base, uncalibratedReason: "no_body_weight" });
        } else {
            resolved.held.push(answer);
        }
    }
    return resolved;
}

async function processClaimedReply(args: {
    job: IntakeJob;
    intake: PlanIntakeState;
    coachId: string;
    coachUserId: string;
    roomId: string;
    studentId: string;
}): Promise<{ handled: boolean; hasNewerMessages: boolean }> {
    const { job, intake, coachId, coachUserId, roomId, studentId } = args;
    const pending = intake.questions.filter((q) => intake.pendingQuestionIds.includes(q.id));

    const messages = await loadStudentMessagesSince(roomId, studentId, intake.lastProcessedMessageAt);
    if (messages.length === 0 || pending.length === 0) {
        await writeIntakeState(job, { ...intake, processing: null });
        return { handled: false, hasNewerMessages: false };
    }
    const lastMessageAt = messages[messages.length - 1].created_at;
    const reply = await extractReply(pending, messages.map((m) => m.content));
    if (!reply.related) {
        await writeIntakeState(job, { ...intake, processing: null, lastProcessedMessageAt: lastMessageAt });
        return { handled: false, hasNewerMessages: false };
    }

    const { data: profile } = await db()
        .from("user_profiles")
        .select("nickname, full_name, weight")
        .eq("user_id", studentId)
        .maybeSingle();
    const bodyWeight = reply.bodyWeightKg ?? runtimeBodyWeight(profile);
    const bodyWeightPending = pending.some((q) => q.id === "body_weight");
    const bodyWeightUnavailable = reply.unknownQuestionIds.includes("body_weight") || (!bodyWeightPending && !bodyWeight);

    const questionById = new Map(intake.questions.map((q) => [q.id, q]));
    const answers = resolveOneRmAnswers({
        answers: [...intake.heldAnswers, ...reply.oneRmAnswers],
        questionById,
        bodyWeight,
        bodyWeightUnavailable,
    });
    const bodyWeightRecord: PlanIntakeRecord[] = reply.bodyWeightKg !== null
        ? [{ questionId: "body_weight", bodyWeightKg: reply.bodyWeightKg }]
        : [];
    const newRecords = [...bodyWeightRecord, ...answers.records];

    const resolvedIds = new Set<string>([
        ...newRecords.map((r) => r.questionId),
        ...answers.uncalibrated.map((r) => r.questionId),
        ...reply.openAnswers.map((a) => a.questionId),
        ...reply.unknownQuestionIds,
    ]);
    const heldIds = new Set(answers.held.map((h) => h.questionId));
    // 负重动作已回答、只差体重时，动作本身不再问；体重问题没回答会留在 remaining 里。
    const remaining = pending.filter((q) => !resolvedIds.has(q.id) && !heldIds.has(q.id));
    const askForRemaining = remaining.length > 0 && intake.followUpsSent < MAX_FOLLOW_UPS;
    const closed = !askForRemaining;
    // 关闭时还没拿到体重的回答，转告教练而不是丢掉。
    const uncalibrated = closed
        ? [...answers.uncalibrated, ...resolveOneRmAnswers({
            answers: answers.held,
            questionById,
            bodyWeight: null,
            bodyWeightUnavailable: true,
        }).uncalibrated]
        : answers.uncalibrated;

    const notes = [
        ...intake.notes,
        ...reply.openAnswers.map((a) => `${questionById.get(a.questionId)?.prompt || "问题"} → ${a.answer}`),
        ...(reply.otherNotes ? [reply.otherNotes] : []),
    ];
    const riskNotes = reply.riskNotes ? [...intake.riskNotes, reply.riskNotes] : intake.riskNotes;
    const nowIso = new Date().toISOString();

    const nextIntake: PlanIntakeState = {
        ...intake,
        status: closed ? "answered" : "awaiting_reply",
        pendingQuestionIds: closed ? [] : remaining.map((q) => q.id),
        answeredQuestionIds: [
            ...intake.answeredQuestionIds,
            ...newRecords.map((r) => r.questionId),
            ...uncalibrated.map((r) => r.questionId),
            ...reply.openAnswers.map((a) => a.questionId),
        ],
        unknownQuestionIds: [...intake.unknownQuestionIds, ...reply.unknownQuestionIds],
        heldAnswers: closed ? [] : answers.held,
        followUpsSent: askForRemaining ? intake.followUpsSent + 1 : intake.followUpsSent,
        lastProcessedMessageAt: lastMessageAt,
        recorded: [...intake.recorded, ...newRecords, ...uncalibrated],
        notes,
        riskNotes,
        processing: null,
        closedAt: closed ? nowIso : null,
    };
    // 先落状态再写数据：状态写不进去（被别的请求抢先）就什么都不写，不会重复插 PR、重复发消息。
    const saved = await writeIntakeState(job, nextIntake, reply.riskNotes ? { needs_coach_confirmation: true } : {});
    if (!saved) return { handled: true, hasNewerMessages: false };

    let recordFailed = false;
    try {
        if (reply.bodyWeightKg !== null) {
            const { error } = await db()
                .from("user_profiles")
                .update({ weight: reply.bodyWeightKg, updated_at: nowIso })
                .eq("user_id", studentId);
            if (error) throw new Error(`更新体重失败: ${error.message}`);
        }
        await insertSelfReportedRecords({
            studentId,
            coachId,
            records: answers.records.map((record) => {
                const question = questionById.get(record.questionId);
                return {
                    ...record,
                    includesBodyWeight: question?.kind === "one_rm" && question.includesBodyWeight,
                    bodyWeight,
                };
            }),
        });
    } catch (error) {
        recordFailed = true;
        console.error("[plan-intake] record answers failed:", error);
        await writeIntakeState(saved, {
            ...nextIntake,
            error: error instanceof Error ? error.message : String(error),
        }).catch(() => undefined);
    }

    const unknownLabels = reply.unknownQuestionIds.map((id) => {
        const q = questionById.get(id);
        return q?.kind === "one_rm" ? q.actionName : q?.prompt || id;
    });

    await sendDirectMessage({
        fromUserId: coachUserId,
        toUserId: studentId,
        content: buildStudentConfirmation({
            newRecords,
            remaining,
            askForRemaining,
            hasUnknown: reply.unknownQuestionIds.length > 0 || uncalibrated.length > 0,
            hasNotes: Boolean(reply.otherNotes) || reply.openAnswers.length > 0,
            hasRisk: Boolean(reply.riskNotes),
            recordFailed,
        }),
        contentMetadata: assistantMetadata(INTAKE_REPLY_KIND, {
            plan_instance_id: intake.planInstanceId,
            automation_job_id: job.id,
        }),
    });

    const openAnswers = reply.openAnswers.map((a) => ({
        prompt: questionById.get(a.questionId)?.prompt || "问题",
        answer: a.answer,
    }));
    const draftLine = await draftRevisionLine({
        job,
        coachId,
        coachUserId,
        studentId,
        planInstanceId: intake.planInstanceId,
        notes: [...openAnswers.map((a) => `${a.prompt} → ${a.answer}`), ...(reply.otherNotes ? [reply.otherNotes] : [])],
        riskNotes: reply.riskNotes ? [reply.riskNotes] : [],
    });
    const notice = buildCoachNotice({
        studentName: displayName(profile),
        newRecords,
        uncalibrated,
        unknownLabels,
        openAnswers,
        otherNotes: reply.otherNotes,
        riskNotes: reply.riskNotes,
        remainingCount: closed ? remaining.length : 0,
        recordFailed,
    });
    await sendSystemMessage(coachUserId, {
        content: draftLine ? `${notice}\n${draftLine}` : notice,
        // 可能包含伤病等健康信息，锁屏推送只显示这句概括。
        content_metadata: { push_preview: "学员回复了计划助理的问题，请查看。" },
    } as any).catch((error: unknown) => console.error("[plan-intake] notify coach failed:", error));

    const hasNewerMessages = !closed &&
        (await loadStudentMessagesSince(roomId, studentId, lastMessageAt)).length > 0;
    return { handled: true, hasNewerMessages };
}
