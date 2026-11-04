/**
 * AI 批量操作上下文构建：根据 contextOptions 拉取档案/问卷/执行/动作库/模板等，生成注入给 AI 的 prompt 文本。
 * 供 batch-operation 与 batch-operation-context-preview 共用。
 *
 * - 学员数据只在教练仍持有该学员的有效订阅时读取（前任教练不能再读）。
 * - 执行记录、反馈只取当前订阅的计划实例，不混入学员和其他教练的计划。
 * - 学员关键数据（动作名 → 1RM、体重、伤病）放在最前面，并且按段截断，不会被整体截断切掉。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BatchOperationContextOptions } from "./entity";
import {
    LIVE_SUBSCRIPTION_STATUSES,
    STUDENT_TEXT_NOTICE,
    assembleContextSections,
    buildLockedDaysSection,
    buildQuotedFeedbackSection,
    buildStudentFactsSection,
    extractInjuryNotes,
    isLiveSubscriptionStatus,
    mergeOneRmFacts,
    quoteStudentText,
    type ContextSection,
    type StudentOneRmFact,
} from "@/lib/planAssistantContext";
import { matchProfileLifts, resolveProfileBodyWeight } from "@/lib/coachingAutomation/profileOneRm";

export type TargetActionType = "coach" | "student";

const FULL_CONTEXT_BUDGET = 12_000;
const COMPACT_CONTEXT_BUDGET = 3_500;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// 运动数据卡主项；用作 1RM 的最低优先级兜底。
const CARD_LIFT_LABELS = ["深蹲", "卧推", "硬拉", "负重引体", "负重臂屈伸", "负重双力臂", "抓举", "挺举"];

function safeJsonPreview(input: unknown, maxLen = 800): string {
    try {
        const text = JSON.stringify(input ?? null);
        if (!text) return "null";
        return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
    } catch {
        return String(input ?? "null");
    }
}

function normalizeStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item: any) => String(item || "").trim()).filter(Boolean) : [];
}

function collectQuestionnaireRmActionIds(steps: any[]): string[] {
    const ids = new Set<string>();
    for (const step of steps || []) {
        if (step?.type !== "rm" || !step.userInputs || typeof step.userInputs !== "object") continue;
        for (const key of Object.keys(step.userInputs)) {
            if (UUID_REGEX.test(key)) ids.add(key);
        }
    }
    return Array.from(ids);
}

/** rm 题的 userInputs 以动作 id 为键；换成动作名，模型才知道是哪个动作的 1RM。 */
function mapRmInputsToNames(userInputs: Record<string, unknown>, actionNameById: Map<string, string>): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, raw] of Object.entries(userInputs || {})) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) continue;
        if (/^\d+$/.test(key)) continue; // 旧版问卷的下标键，无法对应动作
        const name = UUID_REGEX.test(key) ? actionNameById.get(key) : key;
        if (name) result[name] = value;
    }
    return result;
}

/**
 * 将购买计划时的 subscribe_data 数组（问卷步骤）转换为 AI 可读的 key-value 摘要对象。
 *
 * 这份数据属于当前订阅/计划，不能与注册时的 onboarding_questionnaires 混为一谈。
 */
function parseSubscriptionQuestionnaire(
    steps: any[],
    actionNameById: Map<string, string>,
): { answers: Record<string, any>; oneRmByName: Record<string, number> } {
    const answers: Record<string, any> = {};
    const oneRmByName: Record<string, number> = {};
    steps.forEach((step, index) => {
        if (!step) return;
        const q = String(step.question || step.title || step.label || step.name || `第${index + 1}题`);
        const type = String(step.type || "");
        if (type === "tags" && Array.isArray(step.userSelections)) {
            answers[q] = step.userSelections;
        } else if (type === "rm") {
            let inputs = step.userInputs;
            if (typeof inputs === "string") {
                try { inputs = JSON.parse(inputs); } catch { inputs = null; }
            }
            if (inputs && typeof inputs === "object") {
                const byName = mapRmInputsToNames(inputs, actionNameById);
                Object.assign(oneRmByName, byName);
                if (Object.keys(byName).length > 0) answers[q] = byName;
            }
        } else if (type === "option" && q && step.userSelection !== undefined) {
            const opts = Array.isArray(step.options) ? step.options : [];
            const selected = opts[step.userSelection];
            answers[q] = selected !== undefined ? selected : step.userSelection;
        } else if (q && step.userSelection !== undefined) {
            answers[q] = step.userSelection;
        } else if (q && Array.isArray(step.userSelections)) {
            answers[q] = step.userSelections;
        } else if (q && step.userInputs && typeof step.userInputs === "object") {
            answers[q] = step.userInputs;
        }
    });
    return { answers, oneRmByName };
}

function normalizeActionNameKey(name: unknown): string {
    return String(name || "")
        .toLowerCase()
        .replace(/[\s\-_()（）【】\[\]·,，.。]/g, "")
        .trim();
}

function summarizeExecutionStatus(rows: any[]): string {
    const stats = { total: rows.length, completed: 0, active: 0, skipped: 0 };
    for (const row of rows) {
        const status = String(row?.status || "").toLowerCase();
        if (status === "completed" || status === "finished") stats.completed += 1;
        else if (status === "active" || status === "in_progress") stats.active += 1;
        else if (status === "skipped") stats.skipped += 1;
    }
    return `总执行 ${stats.total} 次，完成 ${stats.completed} 次，进行中 ${stats.active} 次，跳过 ${stats.skipped} 次`;
}

function buildTemplateMatchSummary(params: {
    templates: any[];
    fitnessLevel?: string | null;
    questionnaireAnswers?: Record<string, any> | null;
}): string {
    const { templates, fitnessLevel, questionnaireAnswers } = params;
    if (!templates || templates.length === 0) return "暂无可匹配模板。";
    const answers = questionnaireAnswers || {};
    const interests = [
        ...normalizeStringArray(answers.fitness_goals),
        ...normalizeStringArray(answers.interest_tags),
        ...normalizeStringArray(answers.target_body_parts),
    ];
    const preferredTimes = typeof answers.weekly_frequency === "number"
        ? answers.weekly_frequency
        : (typeof answers.times === "number" ? answers.times : null);

    const scored = templates.map((tpl: any) => {
        let score = 0;
        const reasons: string[] = [];
        const tplLevel = String(tpl?.suitable_for || "");
        if (fitnessLevel && tplLevel && tplLevel === fitnessLevel) {
            score += 2;
            reasons.push("水平匹配");
        }
        const tplTags = Array.isArray(tpl?.tags) ? tpl.tags.map((x: any) => String(x)) : [];
        const tagOverlap = tplTags.filter((tag: string) => interests.includes(tag)).length;
        if (tagOverlap > 0) {
            score += Math.min(3, tagOverlap);
            reasons.push(`兴趣标签命中 ${tagOverlap}`);
        }
        const weekDays = Array.isArray(tpl?.week_days) ? tpl.week_days : [];
        if (preferredTimes != null && weekDays.includes(preferredTimes)) {
            score += 1.5;
            reasons.push("每周频次匹配");
        }
        const globalAnswers = tpl?.global_answers && typeof tpl.global_answers === "object" ? tpl.global_answers as Record<string, any> : null;
        if (globalAnswers) {
            let globalMatch = 0;
            for (const [k, v] of Object.entries(globalAnswers)) {
                if (answers[k] !== undefined && answers[k] === v) globalMatch += 1;
            }
            if (globalMatch > 0) {
                score += Math.min(2, globalMatch);
                reasons.push(`全局问卷匹配 ${globalMatch}`);
            }
        }
        return { id: tpl.id, name: tpl.name, score, reasons: reasons.length > 0 ? reasons.join("、") : "通用候选" };
    });

    const top = scored.sort((a, b) => b.score - a.score).slice(0, 3);
    return top.map((x, idx) => `${idx + 1}. ${x.name}（score=${x.score.toFixed(1)}，${x.reasons}）`).join("\n");
}

function computeAge(profile: any): number | null {
    const direct = Number(profile?.age);
    if (Number.isFinite(direct) && direct > 0 && direct < 120) return Math.floor(direct);
    const birth = profile?.birth_date ? new Date(profile.birth_date) : null;
    if (!birth || Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const beforeBirthday = now.getMonth() < birth.getMonth() ||
        (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
    if (beforeBirthday) age -= 1;
    return age > 0 && age < 120 ? age : null;
}

function buildProfileSection(profile: any, bodyWeightKg: number | null): string {
    const age = computeAge(profile);
    const height = Number(profile?.height);
    const lines = ["## 学员档案"];
    lines.push(`- 性别: ${profile?.gender || "未填写"}；年龄: ${age ?? "未知"}；身高: ${Number.isFinite(height) && height > 0 ? `${height}cm` : "未知"}；体重: ${bodyWeightKg ? `${bodyWeightKg}kg` : "未知"}`);
    lines.push(`- 训练目标: ${profile?.fitness_goal || "未填写"}；训练水平: ${profile?.fitness_level || "未填写"}`);
    if (String(profile?.lifestyle || "").trim()) lines.push(`- 生活方式（学员原话）: ${quoteStudentText(profile.lifestyle, 160)}`);
    if (String(profile?.bio || "").trim()) lines.push(`- 简介（学员原话）: ${quoteStudentText(profile.bio, 160)}`);
    return lines.join("\n");
}

export interface BuildContextParams {
    userId: string;
    targetActionType: TargetActionType;
    templateId?: string;
    contextOptions?: BatchOperationContextOptions;
    supabase: SupabaseClient;
    /** 当前动作库；运动数据卡的主项 1RM 按库里的动作名列出，模型写 1RM 指令时才能精确对上。 */
    actions?: Array<{ id: string; name?: string | null }>;
}

export interface BuildContextResult {
    /** 完整上下文（查询、旧代码引擎、整份脚本生成使用）。 */
    prompt: string;
    /** 局部补丁提示词使用的精简上下文：关键数据、锁定、反馈、问卷优先，不含动作库/模板。 */
    compactPrompt: string;
    enabled: string[];
    unavailable: string[];
}

type SubjectResolution = {
    subjectUserId: string | null;
    subscription: { id: string; student_id: string; subscribe_data?: any; coach_id?: string | null } | null;
};

async function resolveCoachSubject(params: {
    supabase: SupabaseClient;
    userId: string;
    coachId: string | null;
    subscriptionId?: string;
    hintedSubjectUserId: string | null;
}): Promise<SubjectResolution> {
    const { supabase, userId, coachId, subscriptionId, hintedSubjectUserId } = params;
    // coach_subscriptions.coach_id 新口径是 coaches.id，旧口径是 users.id；两者都认。
    const ownerIds = Array.from(new Set([coachId, userId].filter(Boolean) as string[]));

    if (subscriptionId) {
        const { data: subRow } = await supabase
            .from("coach_subscriptions")
            .select("id,student_id,subscribe_data,coach_id,status")
            .eq("id", subscriptionId)
            .maybeSingle();
        const owned = !!subRow && ownerIds.includes(String((subRow as any).coach_id || ""));
        if (owned && subRow?.student_id && isLiveSubscriptionStatus((subRow as any).status)) {
            return { subjectUserId: String(subRow.student_id), subscription: subRow as any };
        }
        return { subjectUserId: null, subscription: null };
    }

    if (hintedSubjectUserId && ownerIds.length > 0) {
        const { data: liveRows } = await supabase
            .from("coach_subscriptions")
            .select("id,student_id,coach_id,status")
            .eq("student_id", hintedSubjectUserId)
            .in("coach_id", ownerIds)
            .in("status", [...LIVE_SUBSCRIPTION_STATUSES])
            .order("created_at", { ascending: false })
            .limit(1);
        const live = (liveRows || [])[0] as any;
        if (live?.student_id) {
            return { subjectUserId: String(live.student_id), subscription: { ...live, subscribe_data: null } };
        }
    }
    return { subjectUserId: null, subscription: null };
}

async function loadActionNamesByIds(supabase: SupabaseClient, ids: string[], subjectUserId: string | null) {
    const nameById = new Map<string, string>();
    if (ids.length === 0) return nameById;
    const [coachRows, studentRows] = await Promise.all([
        supabase.from("coach_actions").select("id,name").in("id", ids),
        subjectUserId
            ? supabase.from("student_actions").select("id,name").eq("user_id", subjectUserId).in("id", ids)
            : Promise.resolve({ data: [] as any[] }),
    ]);
    for (const row of [...((coachRows as any).data || []), ...((studentRows as any).data || [])]) {
        if (row?.id && row?.name) nameById.set(String(row.id), String(row.name));
    }
    return nameById;
}

async function loadRecordedOneRms(userId: string, subjectUserId: string): Promise<StudentOneRmFact[]> {
    try {
        const { getCurrent1RMRecords } = await import("@/app/api/student/get-current-1rm/route");
        // 调用方已通过有效订阅完成归属校验。
        const records = await getCurrent1RMRecords(
            userId,
            { targetUserId: subjectUserId, preferPR: true },
            { authorizationVerified: true },
        );
        return (records || []).map((record) => ({
            actionName: String(record.actionName || "").trim(),
            oneRm: Number(record.current1RM),
            source: record.isAutoCalculated ? "训练记录推算" : "PR/动作库",
        }));
    } catch (error) {
        console.warn("[batch-operation/context] load 1RM records failed:", error);
        return [];
    }
}

/**
 * 构建本次批量操作会注入给 AI 的“额外上下文”文本及启用/不可用项列表。
 */
export async function buildBatchOperationContext(params: BuildContextParams): Promise<BuildContextResult> {
    const { userId, targetActionType, templateId, contextOptions, supabase } = params;
    const hintedSubjectUserId = String(contextOptions?.subjectUserId || "").trim() || null;
    const options = {
        includeStudentProfile: contextOptions?.includeStudentProfile ?? true,
        includeStudentQuestionnaire: contextOptions?.includeStudentQuestionnaire ?? true,
        includeExecutionHistory: contextOptions?.includeExecutionHistory ?? true,
        includeStudentActionLib: contextOptions?.includeStudentActionLib ?? false,
        includeCoachActionLib: contextOptions?.includeCoachActionLib ?? true,
        includePublicActionLib: contextOptions?.includePublicActionLib ?? true,
        includeCoachTemplates: contextOptions?.includeCoachTemplates ?? true,
        includeTemplateMatch: contextOptions?.includeTemplateMatch ?? true,
        includeFeedbacks: contextOptions?.includeFeedbacks ?? true,
        subscriptionId: contextOptions?.subscriptionId,
    };
    const enabled: string[] = [];
    const unavailable: string[] = [];
    const actionNameSeen = new Set<string>();
    const sections: ContextSection[] = [];
    const missingSubjectLine = "- 未定位到目标学员（需要该学员的有效订阅且归属当前教练）";

    let coachId: string | null = null;
    if (targetActionType === "coach") {
        const { data: coachRow } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();
        coachId = coachRow?.id || null;
    }

    const subject: SubjectResolution = targetActionType === "student"
        ? { subjectUserId: userId, subscription: null }
        : await resolveCoachSubject({
            supabase,
            userId,
            coachId,
            subscriptionId: options.subscriptionId,
            hintedSubjectUserId,
        });
    const { subjectUserId, subscription } = subject;

    const headerLines = [`- 目标角色: ${targetActionType}`];
    if (subjectUserId) headerLines.push(`- 目标学员 user_id: ${subjectUserId}`);
    sections.push({ body: headerLines.join("\n"), maxChars: 200, compact: true, required: true });
    if (subjectUserId) sections.push({ body: STUDENT_TEXT_NOTICE, maxChars: 200, compact: true, required: true });

    // 购买计划问卷（含 rm 题的动作名映射）
    let subscriptionAnswers: Record<string, any> | null = null;
    let questionnaireOneRms: Record<string, number> = {};
    const subscribeSteps = Array.isArray(subscription?.subscribe_data) ? subscription!.subscribe_data as any[] : [];
    if (subscribeSteps.length > 0) {
        const actionNameById = await loadActionNamesByIds(
            supabase,
            collectQuestionnaireRmActionIds(subscribeSteps),
            subjectUserId,
        );
        const parsed = parseSubscriptionQuestionnaire(subscribeSteps, actionNameById);
        subscriptionAnswers = parsed.answers;
        questionnaireOneRms = parsed.oneRmByName;
    }

    let profileRow: any = null;
    if (options.includeStudentProfile && subjectUserId) {
        const { data } = await supabase
            .from("user_profiles")
            .select("gender,age,birth_date,height,weight,fitness_goal,fitness_level,lifestyle,bio,sport_cards")
            .eq("user_id", subjectUserId)
            .maybeSingle();
        profileRow = data || null;
    }

    let onboardingAnswers: Record<string, any> | null = null;
    if (options.includeStudentQuestionnaire && subjectUserId) {
        const { data } = await supabase
            .from("onboarding_questionnaires")
            .select("answers,created_at")
            .eq("user_id", subjectUserId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        onboardingAnswers = data?.answers && typeof data.answers === "object" ? (data.answers as Record<string, any>) : null;
    }

    // 学员关键数据：1RM（PR/动作库 > 购买问卷 > 运动卡）、体重、伤病
    if (subjectUserId && (options.includeStudentProfile || options.includeStudentActionLib)) {
        const bodyWeightKg = resolveProfileBodyWeight(profileRow);
        const recorded = await loadRecordedOneRms(userId, subjectUserId);
        const fromQuestionnaire = Object.entries(questionnaireOneRms).map(([actionName, oneRm]) => ({
            actionName,
            oneRm,
            source: "购买问卷",
        }));
        const cardActionRefs = params.actions?.length
            ? params.actions.map((action) => ({ id: String(action.id), name: action.name }))
            : CARD_LIFT_LABELS.map((label) => ({ id: label, name: label }));
        const fromCards = matchProfileLifts(profileRow?.sport_cards, cardActionRefs)
            .map((match) => ({ actionName: match.actionName || match.label, oneRm: match.oneRm, source: "运动数据卡" }));
        const injuryNotes = options.includeStudentQuestionnaire
            ? extractInjuryNotes(subscriptionAnswers, onboardingAnswers)
            : [];
        sections.push({
            body: buildStudentFactsSection({
                bodyWeightKg,
                oneRms: mergeOneRmFacts(recorded, fromQuestionnaire, fromCards),
                injuryNotes,
            }),
            maxChars: 2_000,
            compact: true,
            required: true,
        });
        enabled.push("学员1RM与体重");
    }

    sections.push({
        body: buildLockedDaysSection(Number(contextOptions?.lockedThroughDayIndex || 0)),
        maxChars: 500,
        compact: true,
        required: true,
    });

    // 当前订阅的计划实例：执行记录和反馈只看这些实例
    let instanceIds: string[] = [];
    let currentInstanceId: string | null = null;
    // 教练端必须落到具体订阅上；学员端读自己的计划。
    const instanceScopeKnown = targetActionType === "student" || !!subscription?.id;
    if ((options.includeExecutionHistory || options.includeFeedbacks) && subjectUserId && instanceScopeKnown) {
        let instanceQuery = supabase
            .from("coach_plan_instances")
            .select("id,name,status,created_at,updated_at")
            .eq("student_id", subjectUserId);
        if (targetActionType === "coach" && subscription?.id) {
            instanceQuery = instanceQuery.eq("coach_subscription_id", subscription.id);
        }
        const { data: instances } = await instanceQuery
            .order("created_at", { ascending: false })
            .limit(6);
        instanceIds = (instances || []).map((x: any) => x.id);
        const current = (instances || []).find((x: any) => ["active", "paused", "completed"].includes(String(x.status)));
        currentInstanceId = current?.id || null;
    }

    if (options.includeFeedbacks && !subjectUserId) {
        unavailable.push("学员反馈");
    } else if (options.includeFeedbacks && currentInstanceId) {
        const { data: feedbacks } = await supabase
            .from("execution_feedbacks")
            .select("day_index,content,difficulty_rating,created_at")
            .eq("instance_id", currentInstanceId)
            .eq("student_id", subjectUserId)
            .order("created_at", { ascending: false })
            .limit(10);
        sections.push({ body: buildQuotedFeedbackSection(feedbacks || []), maxChars: 3_000, compact: true });
        enabled.push("学员反馈");
    } else if (options.includeFeedbacks) {
        unavailable.push("学员反馈");
    }

    if (options.includeStudentQuestionnaire && !subjectUserId) {
        sections.push({ body: `## 注册问卷\n${missingSubjectLine}`, maxChars: 200 });
        unavailable.push("注册问卷");
        if (options.subscriptionId) unavailable.push("购买计划问卷");
    } else if (options.includeStudentQuestionnaire && subjectUserId) {
        const purchaseLines = [
            "## 购买计划问卷（学员原话）",
            "- 数据来源：本次订阅（当前计划）时填写的问卷；它与注册问卷是两份独立数据，优先用于判断本计划的目标、限制与偏好。",
        ];
        if (subscriptionAnswers && Object.keys(subscriptionAnswers).length > 0) {
            enabled.push("购买计划问卷");
            purchaseLines.push(`- 回答摘要: ${safeJsonPreview(subscriptionAnswers, 1_300)}`);
        } else if (subscription?.id && options.subscriptionId) {
            purchaseLines.push("- 当前订阅未找到购买计划问卷回答");
            unavailable.push("购买计划问卷");
        } else {
            purchaseLines.push("- 未传入当前订阅，无法读取购买计划问卷");
            unavailable.push("购买计划问卷");
        }
        sections.push({ body: purchaseLines.join("\n"), maxChars: 1_600, compact: true });

        const onboardingLines = ["## 注册问卷（学员原话）"];
        if (onboardingAnswers) {
            enabled.push("注册问卷");
            const goals = normalizeStringArray((onboardingAnswers as any).fitness_goals);
            if (goals.length > 0) onboardingLines.push(`- fitness_goals: ${goals.join("、")}`);
            if (typeof (onboardingAnswers as any).weekly_frequency === "number") {
                const freq = Number((onboardingAnswers as any).weekly_frequency);
                onboardingLines.push(`- weekly_frequency: ${freq >= 6 ? "6 天及以上" : `${freq} 天`}`);
            }
            onboardingLines.push(`- 回答摘要: ${safeJsonPreview(onboardingAnswers, 700)}`);
        } else {
            onboardingLines.push("- 未找到注册时填写的问卷回答");
            unavailable.push("注册问卷");
        }
        sections.push({ body: onboardingLines.join("\n"), maxChars: 1_100, compact: true });

        sections.push({
            body: "## 问卷使用规则\n" +
                "- 注册问卷描述学员注册产品时的基础情况；购买计划问卷描述其购买当前计划时的专项目标、限制与偏好。回答问卷来源时必须明确区分两者，不得将任一份称为另一份。\n" +
                "- 制定或修改当前计划时，优先遵从购买计划问卷中的明确目标、伤病/禁忌和器械限制；若两份问卷冲突，应指出冲突并请教练确认，而不是静默混合或覆盖。",
            maxChars: 400,
            compact: true,
        });
    }

    if (options.includeStudentProfile && !subjectUserId) {
        sections.push({ body: `## 学员档案\n${missingSubjectLine}`, maxChars: 200 });
        unavailable.push("学员基本情况");
    } else if (options.includeStudentProfile && profileRow) {
        enabled.push("学员基本情况");
        sections.push({ body: buildProfileSection(profileRow, resolveProfileBodyWeight(profileRow)), maxChars: 700, compact: true });
    } else if (options.includeStudentProfile) {
        unavailable.push("学员基本情况");
    }

    if (options.includeExecutionHistory && !subjectUserId) {
        unavailable.push("执行记录");
    } else if (options.includeExecutionHistory && instanceIds.length > 0) {
        const { data: execs } = await supabase
            .from("plan_instance_executions")
            .select("id,instance_id,day_index,status,started_at,completed_at")
            .in("instance_id", instanceIds)
            .order("started_at", { ascending: false })
            .limit(60);
        const executionRows = execs || [];
        enabled.push("执行记录");
        sections.push({
            body: [
                "## 历史执行摘要（当前订阅的计划）",
                `- ${summarizeExecutionStatus(executionRows)}`,
                `- 最近执行: ${safeJsonPreview(executionRows.slice(0, 5), 520)}`,
            ].join("\n"),
            maxChars: 800,
            compact: true,
        });
    } else if (options.includeExecutionHistory) {
        unavailable.push("执行记录");
    }

    if (options.includeCoachActionLib && targetActionType === "coach") {
        const { data: coachActions } = await supabase
            .from("coach_actions")
            .select("id,name,type")
            .eq("coach_id", userId)
            .order("updated_at", { ascending: false })
            .limit(30);
        if (coachActions && coachActions.length > 0) {
            enabled.push("教练动作库");
            const sampled = coachActions.slice(0, 20);
            for (const a of sampled as any[]) actionNameSeen.add(normalizeActionNameKey(a.name));
            sections.push({
                body: `## 教练动作库摘要\n${sampled.map((a: any) => `- ${a.name} (${a.type || "STRENGTH"})`).join("\n")}`,
                maxChars: 1_000,
            });
        } else {
            sections.push({ body: "## 教练动作库摘要\n- 教练动作库为空", maxChars: 200 });
            unavailable.push("教练动作库");
        }
    }

    if (options.includeStudentActionLib && !subjectUserId) {
        sections.push({ body: `## 学员动作库摘要\n${missingSubjectLine}`, maxChars: 200 });
        unavailable.push("学员动作库");
    } else if (options.includeStudentActionLib && subjectUserId) {
        const { data: studentActions } = await supabase
            .from("student_actions")
            .select("id,name,type")
            .eq("user_id", subjectUserId)
            .order("updated_at", { ascending: false })
            .limit(30);
        if (studentActions && studentActions.length > 0) {
            enabled.push("学员动作库");
            const sampled = studentActions.slice(0, 20);
            for (const a of sampled as any[]) actionNameSeen.add(normalizeActionNameKey(a.name));
            sections.push({
                body: `## 学员动作库摘要（1RM 见“学员关键数据”）\n${sampled.map((a: any) => `- ${a.name} (${a.type || "STRENGTH"})`).join("\n")}`,
                maxChars: 1_000,
            });
        } else {
            sections.push({ body: "## 学员动作库摘要\n- 学员动作库为空", maxChars: 200 });
            unavailable.push("学员动作库");
        }
    }

    if (options.includePublicActionLib) {
        const { data: publicActions } = await supabase
            .from("community_actions")
            .select("id,name,type,like_count")
            .order("like_count", { ascending: false })
            .limit(120);
        if (publicActions && publicActions.length > 0) {
            enabled.push("公共动作库");
            const deduped: any[] = [];
            for (const a of publicActions as any[]) {
                const key = normalizeActionNameKey(a.name);
                if (!key || actionNameSeen.has(key)) continue;
                actionNameSeen.add(key);
                deduped.push(a);
                if (deduped.length >= 20) break;
            }
            const sampled = deduped.length > 0 ? deduped : (publicActions as any[]).slice(0, 20);
            sections.push({
                body: [
                    "## 公共动作库摘要",
                    sampled.map((a: any) => `- ${a.name} (${a.type || "STRENGTH"}, likes=${a.like_count || 0})`).join("\n"),
                    "- 公共动作库展示策略：按热度优先，最多展示 20 条（已做跨动作库去重）",
                ].join("\n"),
                maxChars: 1_200,
            });
        } else {
            sections.push({ body: "## 公共动作库摘要\n- 暂无可用公共动作", maxChars: 200 });
            unavailable.push("公共动作库");
        }
    }

    let coachTemplates: any[] = [];
    if (options.includeCoachTemplates && coachId) {
        const { data } = await supabase
            .from("coach_plan_templates")
            .select("id,name,description,tags,suitable_for,training_days_count,week_days,global_answers,updated_at")
            // coach_plan_templates 在当前链路以 users.id 作为 owner（与 update-template/get-overview-data 一致）
            .eq("coach_id", userId)
            .order("updated_at", { ascending: false })
            .limit(12);
        coachTemplates = (data || []).filter((tpl: any) => !templateId || tpl.id !== templateId);
        if (coachTemplates.length > 0) {
            enabled.push("教练模板");
            sections.push({
                body: `## 教练模板库摘要\n${coachTemplates
                    .slice(0, 6)
                    .map((tpl: any) => `- ${tpl.name}（suitable_for=${tpl.suitable_for || "-"}，days=${tpl.training_days_count || "-"}，tags=${Array.isArray(tpl.tags) ? tpl.tags.join("/") : "-"}`)
                    .join("\n")}`,
                maxChars: 1_000,
            });
        } else {
            sections.push({ body: "## 教练模板库摘要\n- 暂无可用模板", maxChars: 200 });
            unavailable.push("教练模板");
        }
    }

    if (options.includeTemplateMatch && coachTemplates.length > 0) {
        enabled.push("模板匹配");
        sections.push({
            body: `## 模板匹配建议（可先复用再微调）\n${buildTemplateMatchSummary({
                templates: coachTemplates,
                fitnessLevel: profileRow?.fitness_level || null,
                // 模板匹配保持使用注册问卷的标准字段；购买计划问卷仍会作为独立上下文给模型判断。
                questionnaireAnswers: onboardingAnswers || null,
            })}`,
            maxChars: 600,
        });
    }

    sections.push({
        body: "## 执行权限说明\n" +
            "- 当前接口仅能修改当前计划 trainingDays；不能直接新建模板。\n" +
            "- 若你判断应沉淀为模板，请在 actionPlan 中明确提出“建议创建模板”与模板命名建议。",
        maxChars: 300,
    });

    return {
        prompt: assembleContextSections(sections, { totalBudget: FULL_CONTEXT_BUDGET }),
        compactPrompt: assembleContextSections(sections, { totalBudget: COMPACT_CONTEXT_BUDGET, compactOnly: true }),
        enabled: Array.from(new Set(enabled)),
        unavailable: Array.from(new Set(unavailable)),
    };
}
