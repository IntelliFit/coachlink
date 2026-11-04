import { NextRequest } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import {
    BatchOperationDto,
    SSEMessage,
    ModificationDiff,
    NewActionDetected,
    PendingActionCandidate,
    OneRmAdjustmentPreview,
} from "./entity";
import { buildBatchOperationContext } from "./context";
import type { ItemType } from "@/types";
import { sanitizeActionName } from "@/lib/planImportText";
import {
    getCoachlinkFastLlm,
    getCoachlinkPlanLlm,
    getCoachlinkPlanScriptFallbackLlm,
    getCoachlinkPlanScriptLlm,
} from "@/lib/coachlinkLlm";
import {
    isWeeklyScheduleMoveInstruction,
    tryApplyDeterministicBatchEdit,
} from "@/lib/batchOperationDeterministic";
import {
    formatTemplateToPlanScript,
    mergePlanScriptDayPatches,
    parsePlanScript,
} from "@/lib/planScript";
import { resolveOneRmAdjustments, type OneRmAdjustmentDraft } from "@/lib/oneRmAdjustments";
import { applyLoadAdjustments, type LoadAdjustmentDraft } from "@/lib/loadAdjustments";
import {
    analyzeModifications,
    describeNoChangeTurn,
    findUnresolvedOneRmDrafts,
    normalizeItemType,
    normalizeTrainingDaysForEditor,
} from "@/lib/planAssistantEdits";
import { executeCodeInVM } from "@/lib/planCodeSandbox";
import {
    LIVE_SUBSCRIPTION_STATUSES,
    isLiveSubscriptionStatus,
    normalizeLockedThroughDayIndex,
} from "@/lib/planAssistantContext";
import { describeLockedRange, mergeLockedPlanDays } from "@coachlink/core/src/planEditLock";
import { createPlanEditSseResponse } from "@/lib/planEditSse";
import {
    compileDetailedLongPlanDeterministically,
    countLongPlanActionPrescriptions,
    mergeCompiledPlanScriptParts,
    normalizeCompiledPlanScriptPart,
    splitDetailedLongPlanInstruction,
    splitLongPlanWeeksForCompilation,
    type DetailedLongPlanInstruction,
    type LongPlanCompilationPart,
} from "@/lib/longPlanInstruction";

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV === 'development';

function buildPromptMessages(prompt: string): Array<{ role: "system" | "user"; content: string }> {
    return [
        {
            role: "system",
            content: "你是 coachlink 的训练计划 AI 助手。请严格遵循用户提示词中的任务、约束和输出格式要求。",
        },
        {
            role: "user",
            content: prompt,
        },
    ];
}

function isRetryableLlmConnectionError(error: any) {
    const message = `${error?.message || ""} ${error?.cause?.message || ""}`.toLowerCase();
    const code = String(error?.cause?.code || error?.code || "").toUpperCase();
    return message.includes("connection error") || message.includes("fetch failed") ||
        message.includes("other side closed") || code === "UND_ERR_SOCKET" || code === "ECONNRESET";
}

function formatBatchOperationError(error: any) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("timed out") || message.includes("timeout")) {
        return '万界方舟在限定时间内未返回结果。现有计划修改已按局部小段请求并由服务端合并；请稍后重试，并查看日志中的 patch chunk 定位失败段。';
    }
    if (isRetryableLlmConnectionError(error)) {
        return '万界方舟连接在返回结果前被中断。现有计划修改会先请求局部 PlanScript 补丁，OpenAI 兼容通道失败后再切换万界方舟 Anthropic 通道；若两条通道都失败，请查看日志中的具体 patch chunk。';
    }
    return error?.message || '操作失败';
}

async function createChatCompletionWithRetry(client: any, body: any, signal: AbortSignal) {
    signal.throwIfAborted();
    try {
        return await client.chat.completions.create(body, { signal });
    } catch (error) {
        signal.throwIfAborted();
        if (!isRetryableLlmConnectionError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 800));
        signal.throwIfAborted();
        return client.chat.completions.create(body, { signal });
    }
}

async function createJsonChatCompletionWithRetry(client: any, body: any, signal: AbortSignal) {
    const completion = await createChatCompletionWithRetry(client, body, signal);
    const content = completion.choices?.[0]?.message?.content?.trim();
    if (content) {
        try {
            JSON.parse(content);
            return completion;
        } catch {
            // 部分兼容模型偶发忽略 response_format；快速重试一次。
        }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    return createChatCompletionWithRetry(client, body, signal);
}

function normalizeActionNameKey(name?: string | null) {
    return String(name || "")
        .toLowerCase()
        .replace(/[\s\-_()（）【】\[\]·,，.。]/g, "")
        .trim();
}

function inferRequestedPlanWeeks(instruction: string): number | null {
    const normalized = String(instruction || "").replace(/[０-９]/g, (char) =>
        String(char.charCodeAt(0) - 0xFF10),
    );
    const candidates = [
        ...Array.from(normalized.matchAll(/(\d{1,2})\s*(?:个)?\s*周/g), (match) => Number(match[1])),
        ...Array.from(normalized.matchAll(/(\d{1,2})\s*(?:个)?\s*月/g), (match) => Number(match[1]) * 4),
    ].filter((value) => Number.isFinite(value) && value > 0);
    return candidates.length > 0 ? Math.max(...candidates) : null;
}

function classifyBatchInstructionLocally(instruction: string): "query" | "modify" | null {
    const text = String(instruction || "").trim();
    if (!text) return null;

    // 先识别明确执行句；普通疑问句即使包含“改”字，也不能触发计划补丁。
    const strongModifyPattern = /((把|将|请|继续|再|重新).{0,40}(修改|调整|改成|改为|换成|替换|增加|添加|减少|降低|提高|删除|去掉|移除|设置|设为|改到|改回|换掉|加到|减到)|(修改|调整|替换|增加|添加|减少|降低|提高|删除|移除)(这个|这些|计划|动作|组数|次数|重量|负荷|休息|第|后|前))/;
    if (strongModifyPattern.test(text)) return "modify";

    const queryPattern = /(查询|分析|统计|看看|查看|告诉我|说明|解释|为什么|为何|怎么|如何|是否|吗[？?]?|呢[？?]?|合理吗|怎么样|有多少|有哪些|哪几|几周|几次|几组|多长|多久|什么|刚才改|改了什么|做了什么)/;
    if (queryPattern.test(text)) return "query";

    const modifyPattern = /(修改|调整|改成|改为|换成|替换|增加|添加|减少|降低|提高|删除|去掉|移除|设置|设为|改到|改回|改一下|换掉|加到|减到)/;
    if (modifyPattern.test(text)) return "modify";
    return null;
}

function formatModificationValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '空';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    try {
        const json = JSON.stringify(value);
        return json.length > 120 ? `${json.slice(0, 117)}...` : json;
    } catch {
        return String(value);
    }
}

function buildModificationSummary(modifications: ModificationDiff[]): string {
    if (!modifications.length) return '本轮没有产生实际修改。';

    const dayIndexes = Array.from(new Set(modifications.map((item) => item.dayIndex))).sort((a, b) => a - b);
    const weeks = Array.from(new Set(dayIndexes.map((dayIndex) => Math.ceil(dayIndex / 7)))).sort((a, b) => a - b);
    const actionNames = Array.from(new Set(
        modifications
            .map((item) => item.actionName)
            .filter((name) => name && !['整个训练日', '训练日类型', '备注'].includes(name)),
    ));
    const details = modifications.slice(0, 12).map((item) =>
        `- 第 ${Math.ceil(item.dayIndex / 7)} 周 D${((item.dayIndex - 1) % 7) + 1} · ${item.actionName} · ${item.field}：${formatModificationValue(item.oldValue)} → ${formatModificationValue(item.newValue)}`,
    );
    const remaining = modifications.length - details.length;

    return [
        `已生成新的预览草稿，共涉及 ${weeks.length} 周、${dayIndexes.length} 个训练日、${modifications.length} 处字段变化。`,
        `范围：${weeks.map((week) => `第 ${week} 周`).join('、')}。`,
        actionNames.length > 0
            ? `主要动作：${actionNames.slice(0, 10).join('、')}${actionNames.length > 10 ? `等 ${actionNames.length} 个动作` : ''}。`
            : '',
        '',
        '主要变化：',
        ...details,
        remaining > 0 ? `- 其余 ${remaining} 处变化可在下方“查看完整差异”中展开。` : '',
        '',
        '当前只是独立预览，尚未写入计划；点击“确认应用”后才会提交。',
    ].filter(Boolean).join('\n');
}

function buildModificationContextPrompt(modifications: ModificationDiff[]): string {
    if (!modifications.length) return '（当前没有待确认的修改草稿）';
    const rows = modifications.slice(0, 160).map((item) => ({
        dayIndex: item.dayIndex,
        week: Math.ceil(item.dayIndex / 7),
        dayOfWeek: ((item.dayIndex - 1) % 7) + 1,
        action: item.actionName,
        field: item.field,
        before: formatModificationValue(item.oldValue),
        after: formatModificationValue(item.newValue),
    }));
    return `${JSON.stringify(rows, null, 2)}${modifications.length > rows.length ? `\n（另有 ${modifications.length - rows.length} 处变化未展开）` : ''}`;
}

function canSkipModificationClarification(instruction: string): boolean {
    const text = String(instruction || "").trim();
    if (!text) return false;

    // 只有“替换为某个类别、但没有具体动作”这一类指令需要模型追问。
    const genericCategoryReplacement = /(改成|改为|换成|替换成|替换为)\s*(有氧|力量|有氧类|力量类|CARDIO|STRENGTH)\s*[。！!，,]?$/i;
    return !genericCategoryReplacement.test(text);
}

function extractPlainPlanScript(raw: string): string {
    const normalized = String(raw || "").replace(/\r\n/g, "\n").trim();
    const fencedBlocks = Array.from(
        normalized.matchAll(/```(?:plan|planscript|text)?\s*\n([\s\S]*?)```/gi),
        (match) => match[1].trim(),
    );
    const fencedScript = fencedBlocks.find((block) => /(?:^|\n)\s*W\d+\s*(?:\n|$)/i.test(block));
    const candidate = fencedScript || normalized;
    const lines = candidate.split("\n");
    const firstWeekLine = lines.findIndex((line) => /^\s*W\d+\s*$/i.test(line));
    const firstOneRmDirective = lines.findIndex((line) => /^\s*1RM\s+/i.test(line));
    const starts = [firstWeekLine, firstOneRmDirective].filter((index) => index >= 0);
    const firstScriptLine = starts.length > 0 ? Math.min(...starts) : -1;
    return (firstScriptLine >= 0 ? lines.slice(firstScriptLine).join("\n") : candidate).trim();
}

type TargetActionType = "coach" | "student";

type ActionOwnerConfig = {
    table: "coach_actions" | "student_actions";
    ownerColumn: "coach_id" | "user_id";
};

type PlanOwnerConfig = {
    table: "coach_plan_templates" | "student_plan_favorites";
    ownerColumn: "coach_id" | "user_id";
};

function getActionOwnerConfig(targetActionType: TargetActionType): ActionOwnerConfig {
    return targetActionType === "student"
        ? { table: "student_actions", ownerColumn: "user_id" }
        : { table: "coach_actions", ownerColumn: "coach_id" };
}

function getPlanOwnerConfig(targetActionType: TargetActionType): PlanOwnerConfig {
    return targetActionType === "student"
        ? { table: "student_plan_favorites", ownerColumn: "user_id" }
        : { table: "coach_plan_templates", ownerColumn: "coach_id" };
}

function inferItemTypeFromSet(actionSet: any): ItemType {
    const rawType = String(actionSet?.itemType || "").toUpperCase();
    if (rawType === "CARDIO" || rawType === "DIET" || rawType === "HABIT" || rawType === "STRENGTH") {
        return normalizeItemType(rawType);
    }

    const params = actionSet?.params || {};
    const customData = params.custom_data || params.customData || {};
    const allKeys = new Set<string>([
        ...Object.keys(params || {}),
        ...Object.keys(customData || {}),
    ]);

    if (
        allKeys.has("distance") || allKeys.has("pace") || allKeys.has("duration") ||
        allKeys.has("距离") || allKeys.has("配速") || allKeys.has("冲刺时长")
    ) {
        return "CARDIO";
    }
    if (
        allKeys.has("calories") || allKeys.has("food_list") || allKeys.has("macro") ||
        allKeys.has("热量") || allKeys.has("食物清单") || allKeys.has("宏量营养")
    ) {
        return "DIET";
    }
    if (
        allKeys.has("habit_name") || allKeys.has("target_duration") ||
        allKeys.has("目标数值") || allKeys.has("完成状态")
    ) {
        return "HABIT";
    }
    return "STRENGTH";
}

function inferSuggestedAttrs(actionSet: any, type: ItemType): string[] {
    if (type === "CARDIO") return ["距离", "配速", "持续时间"];
    if (type === "DIET") return ["食物清单", "热量", "宏量营养"];
    if (type === "HABIT") return ["目标数值", "完成状态"];

    const params = actionSet?.params || {};
    const hasDuration = typeof params["持续时间"] === "number" ||
        typeof params.durationSeconds === "number" ||
        typeof params.duration === "number";
    if (hasDuration) {
        return ["组数", "持续时间", "强度", "休息时间"];
    }
    return ["组数", "次数", "强度", "休息时间"];
}

function collectPendingActions(
    updatedTrainingDays: any[],
    knownActionIds: Set<string>,
): PendingActionCandidate[] {
    const byTempId = new Map<string, PendingActionCandidate>();

    const visitActionSet = (actionSet: any, dayIndex: number) => {
        const actionId = String(actionSet?.actionId || "").trim();
        if (!actionId || knownActionIds.has(actionId)) return;

        const existing = byTempId.get(actionId);
        if (existing) {
            existing.occurrences += 1;
            if (!existing.sourceDayIndexes.includes(dayIndex)) {
                existing.sourceDayIndexes.push(dayIndex);
            }
            return;
        }

        const rawName = String(
            actionSet?.params?.action_name ||
            actionSet?.setName ||
            (actionId.startsWith("pending:") ? actionId.replace(/^pending:/, "") : "") ||
            "",
        );
        const cleaned = sanitizeActionName(rawName);
        const type = inferItemTypeFromSet(actionSet);
        byTempId.set(actionId, {
            tempActionId: actionId,
            suggestedName: cleaned || `待确认动作-${actionId.slice(0, 6)}`,
            suggestedType: type,
            suggestedAttrs: inferSuggestedAttrs(actionSet, type),
            sourceDayIndexes: [dayIndex],
            occurrences: 1,
        });
    };

    for (const day of updatedTrainingDays || []) {
        const dayIndex = Number(day?.dayIndex || 0) || 0;
        for (const set of day?.actionSets || []) {
            visitActionSet(set, dayIndex);
            if (set?.type === "one-filter" && Array.isArray(set?.actions)) {
                for (const inner of set.actions) {
                    visitActionSet(inner, dayIndex);
                }
            }
        }
    }

    return Array.from(byTempId.values()).sort((a, b) => a.suggestedName.localeCompare(b.suggestedName, "zh-CN"));
}

type PlanScriptEditResult = {
    success: boolean;
    actionPlan?: string;
    updatedTrainingDays?: any[];
    oneRmAdjustments?: OneRmAdjustmentDraft[];
    loadAdjustments?: LoadAdjustmentDraft[];
    appliedLoadAdjustments?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    duration?: number;
    error?: string;
};

function buildActionNameById(actions: Array<{ id: string; name: string }>): Record<string, string> {
    return Object.fromEntries((actions || []).map((action) => [String(action.id), String(action.name || "")]));
}

function buildPlanScriptActionLibrary(actions: any[]): string {
    const grouped: Record<ItemType, string[]> = {
        STRENGTH: [],
        CARDIO: [],
        DIET: [],
        HABIT: [],
    };
    for (const action of actions || []) {
        const type = normalizeItemType(action?.type);
        const name = String(action?.name || "").trim();
        if (!name) continue;
        grouped[type].push(name);
    }

    return [
        `力量: ${grouped.STRENGTH.join("、") || "（暂无）"}`,
        `有氧: ${grouped.CARDIO.join("、") || "（暂无）"}`,
        `饮食: ${grouped.DIET.join("、") || "（暂无）"}`,
        `习惯: ${grouped.HABIT.join("、") || "（暂无）"}`,
    ].join("\n");
}

function normalizePlanScriptText(script: string): string {
    return String(script || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
}

async function resolveSubjectUserIdForOneRmAdjustments(params: {
    userId: string;
    targetActionType: TargetActionType;
    contextOptions?: BatchOperationDto["contextOptions"];
}): Promise<string | null> {
    const { userId, targetActionType, contextOptions } = params;
    if (targetActionType === "student") {
        return userId;
    }

    // 只有仍在有效订阅中的教练能调整学员 1RM；前任教练的旧订阅不算。
    const subscriptionId = String(contextOptions?.subscriptionId || "").trim();
    if (subscriptionId) {
        const { data: subscription } = await supabase
            .from("coach_subscriptions")
            .select("student_id, coach_id, status, coaches(user_id)")
            .eq("id", subscriptionId)
            .maybeSingle();
        const coachInfo = subscription?.coaches as any;
        const isOwner = coachInfo?.user_id === userId || String(subscription?.coach_id || "") === userId;
        return isOwner && isLiveSubscriptionStatus(subscription?.status)
            ? String(subscription?.student_id || "") || null
            : null;
    }

    const hintedSubjectUserId = String(contextOptions?.subjectUserId || "").trim();
    if (!hintedSubjectUserId) return null;

    const { data: ownedRows } = await supabase
        .from("coach_subscriptions")
        .select("student_id, coach_id, status, coaches(user_id)")
        .eq("student_id", hintedSubjectUserId)
        .in("status", [...LIVE_SUBSCRIPTION_STATUSES])
        .limit(20);

    const isOwner = (ownedRows || []).some((row: any) => {
        const coachInfo = row?.coaches as any;
        return coachInfo?.user_id === userId || String(row?.coach_id || "") === userId;
    });
    return isOwner ? hintedSubjectUserId : null;
}

async function resolveOneRmPreviewAdjustments(params: {
    drafts?: OneRmAdjustmentDraft[];
    userId: string;
    targetActionType: TargetActionType;
    contextOptions?: BatchOperationDto["contextOptions"];
    actions: any[];
}): Promise<{ adjustments: OneRmAdjustmentPreview[]; hasSubject: boolean }> {
    const drafts = params.drafts || [];
    if (drafts.length === 0) return { adjustments: [], hasSubject: true };

    const subjectUserId = await resolveSubjectUserIdForOneRmAdjustments({
        userId: params.userId,
        targetActionType: params.targetActionType,
        contextOptions: params.contextOptions,
    });
    if (!subjectUserId) return { adjustments: [], hasSubject: false };

    const { getCurrent1RMRecords } = await import("@/app/api/student/get-current-1rm/route");
    const rmRecords = await getCurrent1RMRecords(params.userId, {
        targetUserId: subjectUserId,
        preferPR: true,
    });

    const currentOneRMByActionId: Record<string, number> = {};
    const currentOneRMByCanonicalActionId: Record<string, number> = {};
    const currentOneRMByActionName: Record<string, number> = {};
    for (const record of rmRecords || []) {
        const currentOneRM = Number(record.current1RM);
        if (!Number.isFinite(currentOneRM) || currentOneRM <= 0) continue;
        if (record.actionId) currentOneRMByActionId[String(record.actionId)] = currentOneRM;
        if (record.canonicalActionId) currentOneRMByCanonicalActionId[String(record.canonicalActionId)] = currentOneRM;
        if (record.actionName) currentOneRMByActionName[normalizeActionNameKey(record.actionName)] = currentOneRM;
    }

    const { data: studentActions } = await supabase
        .from("student_actions")
        .select("id, name, canonical_action_id")
        .eq("user_id", subjectUserId);

    const studentActionIdByCanonicalActionId: Record<string, string> = {};
    const studentActionIdByActionName: Record<string, string> = {};
    for (const action of studentActions || []) {
        if (action.canonical_action_id) {
            studentActionIdByCanonicalActionId[String(action.canonical_action_id)] = String(action.id);
        }
        if (action.name) {
            studentActionIdByActionName[normalizeActionNameKey(action.name)] = String(action.id);
        }
    }

    const adjustments = resolveOneRmAdjustments({
        drafts,
        actions: (params.actions || []).map((action: any) => ({
            id: String(action.id),
            name: String(action.name || ""),
            canonical_action_id: action.canonical_action_id || action.canonicalActionId || null,
        })),
        currentOneRMByActionId,
        currentOneRMByCanonicalActionId,
        currentOneRMByActionName,
        studentActionIdByCanonicalActionId,
        studentActionIdByActionName,
    });
    return { adjustments, hasSubject: true };
}

type PlanScriptPatchScope = {
    days: any[];
    reason: string;
};

function getDayWeek(dayIndex: number) {
    return {
        week: Math.ceil(dayIndex / 7),
        dayOfWeek: ((dayIndex - 1) % 7) + 1,
    };
}

function collectExplicitPlanScope(instruction: string, maxWeek: number) {
    const text = String(instruction || "")
        .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xFF10));
    const weeks = new Set<number>();
    const days = new Set<number>();

    for (const match of text.matchAll(/第?\s*(\d{1,2})\s*周\s*(?:到|至|~|～|-|—)\s*第?\s*(\d{1,2})\s*周/g)) {
        const start = Math.min(Number(match[1]), Number(match[2]));
        const end = Math.max(Number(match[1]), Number(match[2]));
        for (let week = start; week <= end; week += 1) weeks.add(week);
    }
    for (const match of text.matchAll(/\bW(\d{1,2})(?:\s*(?:到|至|~|～|-|—)\s*W?(\d{1,2}))?/gi)) {
        const start = Number(match[1]);
        const end = Number(match[2] || match[1]);
        for (let week = Math.min(start, end); week <= Math.max(start, end); week += 1) weeks.add(week);
    }
    for (const match of text.matchAll(/第\s*(\d{1,2})\s*周/g)) weeks.add(Number(match[1]));

    const firstWeeks = text.match(/前\s*(\d{1,2})\s*周/);
    if (firstWeeks) {
        for (let week = 1; week <= Math.min(Number(firstWeeks[1]), maxWeek); week += 1) weeks.add(week);
    }
    const lastWeeks = text.match(/后\s*(\d{1,2})\s*周/);
    if (lastWeeks) {
        const count = Math.min(Number(lastWeeks[1]), maxWeek);
        for (let week = Math.max(1, maxWeek - count + 1); week <= maxWeek; week += 1) weeks.add(week);
    }

    for (const match of text.matchAll(/\bD([1-7])\b/gi)) days.add(Number(match[1]));
    // “第2周第3天”“每周第3天”里的第3天是周内第几天；单独的“第3天”与执行记录、反馈的写法一致，
    // 指计划的第 3 天。
    const absoluteDays = new Set<number>();
    const weekRelative = weeks.size > 0 || /(每|各)\s*(一|个)?\s*(周|星期|礼拜)/.test(text);
    for (const match of text.matchAll(/第\s*(\d{1,3})\s*天/g)) {
        const value = Number(match[1]);
        if (weekRelative && value >= 1 && value <= 7) days.add(value);
        else if (!weekRelative && value >= 1) absoluteDays.add(value);
    }
    const chineseDayMap: Record<string, number> = {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        日: 7,
        天: 7,
    };
    for (const match of text.matchAll(/周([一二三四五六日天])/g)) days.add(chineseDayMap[match[1]]);

    return { weeks, days, absoluteDays };
}

function collectActionIdsMentionedInInstruction(instruction: string, actions: any[]): Set<string> {
    const compactInstruction = normalizeActionNameKey(instruction);
    const mentioned = new Set<string>();
    if (!compactInstruction) return mentioned;

    for (const action of actions || []) {
        const actionKey = normalizeActionNameKey(action?.name);
        const baseActionKey = normalizeActionNameKey(
            String(action?.name || "").replace(/[（(][^）)]*[）)]/g, ""),
        );
        if (
            (actionKey && compactInstruction.includes(actionKey)) ||
            (baseActionKey.length >= 3 && compactInstruction.includes(baseActionKey))
        ) {
            mentioned.add(String(action.id));
        }
    }
    return mentioned;
}

function requiresCompleteWeekPatchScope(instruction: string): boolean {
    return isWeeklyScheduleMoveInstruction(instruction);
}

function actionSetContainsId(actionSet: any, ids: Set<string>): boolean {
    if (ids.has(String(actionSet?.actionId || ""))) return true;
    if (actionSet?.type === "one-filter" && Array.isArray(actionSet.actions)) {
        return actionSet.actions.some((inner: any) => actionSetContainsId(inner, ids));
    }
    return false;
}

function selectPlanScriptPatchScope(
    instruction: string,
    trainingDays: any[],
    actions: any[],
    preferredDayIndexes: number[] = [],
): PlanScriptPatchScope {
    const maxWeek = (trainingDays || []).reduce(
        (maximum, day) => Math.max(maximum, Math.ceil(Number(day?.dayIndex || 0) / 7)),
        0,
    );
    const explicit = collectExplicitPlanScope(instruction, maxWeek);
    const completeWeekScope = requiresCompleteWeekPatchScope(instruction);
    const mentionedActionIds = collectActionIdsMentionedInInstruction(instruction, actions);
    const preferredDays = new Set(preferredDayIndexes.filter((value) => Number.isFinite(value) && value > 0));
    let scoped = [...(trainingDays || [])];
    const reasons: string[] = [];

    // 排期调整必须同时看到源训练日和目标休息日。只发送训练日会让模型无法
    // 把 D3/D5 清空，也无法把内容移动到原来的 D4/D6 休息日。
    if (completeWeekScope) {
        if (explicit.weeks.size > 0) {
            scoped = scoped.filter((day) => explicit.weeks.has(getDayWeek(Number(day?.dayIndex || 0)).week));
            reasons.push(`周次 ${Array.from(explicit.weeks).sort((a, b) => a - b).join("、")} 的完整周`);
        } else {
            reasons.push("全部完整周");
        }
        reasons.push("训练日排期调整（包含休息日）");
        return {
            days: scoped.sort((a, b) => Number(a?.dayIndex || 0) - Number(b?.dayIndex || 0)),
            reason: reasons.join(" + "),
        };
    }

    if (explicit.weeks.size > 0) {
        scoped = scoped.filter((day) => explicit.weeks.has(getDayWeek(Number(day?.dayIndex || 0)).week));
        reasons.push(`周次 ${Array.from(explicit.weeks).sort((a, b) => a - b).join("、")}`);
    }
    if (explicit.days.size > 0) {
        scoped = scoped.filter((day) => explicit.days.has(getDayWeek(Number(day?.dayIndex || 0)).dayOfWeek));
        reasons.push(`训练日 D${Array.from(explicit.days).sort((a, b) => a - b).join("、D")}`);
    }
    if (explicit.absoluteDays.size > 0) {
        scoped = scoped.filter((day) => explicit.absoluteDays.has(Number(day?.dayIndex || 0)));
        reasons.push(`计划第 ${Array.from(explicit.absoluteDays).sort((a, b) => a - b).join("、")} 天`);
    }
    const hasExplicitScope = explicit.weeks.size > 0 || explicit.days.size > 0 || explicit.absoluteDays.size > 0;
    if (!hasExplicitScope && mentionedActionIds.size > 0) {
        scoped = scoped.filter((day) =>
            (day?.actionSets || []).some((set: any) => actionSetContainsId(set, mentionedActionIds)),
        );
        reasons.push("指令中提到的动作所在训练日");
    }
    if (
        !hasExplicitScope &&
        mentionedActionIds.size === 0 &&
        preferredDays.size > 0 &&
        /(继续|再|这些|刚才|它们|同样|一点|一些|上次|上轮)/.test(instruction)
    ) {
        scoped = scoped.filter((day) => preferredDays.has(Number(day?.dayIndex || 0)));
        reasons.push("上轮修改涉及的训练日");
    }

    // 没有明确范围时只发送训练日。休息日无需交给模型重写，可显著缩短长周期计划输入。
    if (!hasExplicitScope && mentionedActionIds.size === 0 && reasons.length === 0) {
        scoped = scoped.filter((day) => day?.type !== "rest");
        reasons.push("全部训练日（不含休息日）");
    }

    return {
        days: scoped.sort((a, b) => Number(a?.dayIndex || 0) - Number(b?.dayIndex || 0)),
        reason: reasons.join(" + ") || "当前计划",
    };
}

function splitPlanScriptPatchChunks(
    days: any[],
    actionNameById: Record<string, string>,
    maxWeeks = 2,
    maxScriptChars = 8_000,
): any[][] {
    const chunks: any[][] = [];
    const daysByWeek = new Map<number, any[]>();
    for (const day of days || []) {
        const week = getDayWeek(Number(day?.dayIndex || 0)).week;
        if (!daysByWeek.has(week)) daysByWeek.set(week, []);
        daysByWeek.get(week)!.push(day);
    }
    let current: any[] = [];

    for (const [, weekDays] of Array.from(daysByWeek.entries()).sort((a, b) => a[0] - b[0])) {
        const sortedWeekDays = weekDays.sort(
            (a, b) => Number(a?.dayIndex || 0) - Number(b?.dayIndex || 0),
        );
        const candidate = [...current, ...sortedWeekDays];
        const candidateWeeks = new Set(
            candidate.map((day) => getDayWeek(Number(day?.dayIndex || 0)).week),
        );
        const candidateChars = formatTemplateToPlanScript({
            trainingDays: candidate,
            actionNameById,
        }).length;
        if (current.length > 0 && (candidateWeeks.size > maxWeeks || candidateChars > maxScriptChars)) {
            chunks.push(current);
            current = sortedWeekDays;
        } else {
            current = candidate;
        }
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
}

function buildPatchActionLibrary(actions: any[], scopedDays: any[], instruction: string): string {
    const usedIds = new Set<string>();
    for (const day of scopedDays || []) {
        for (const set of day?.actionSets || []) {
            usedIds.add(String(set?.actionId || ""));
            for (const inner of set?.actions || []) usedIds.add(String(inner?.actionId || ""));
        }
    }
    const mentionedIds = collectActionIdsMentionedInInstruction(instruction, actions);
    const relevant = (actions || []).filter((action) =>
        usedIds.has(String(action.id)) || mentionedIds.has(String(action.id)),
    );
    return buildPlanScriptActionLibrary(relevant);
}

function parseDayRange(dayRange: string): number[] {
    const match = dayRange.match(/^D([1-7])-D([1-7])$/i);
    if (!match) return [];
    const start = Number(match[1]);
    const end = Number(match[2]);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

async function compileDetailedLongPlanInChunks(params: {
    plan: DetailedLongPlanInstruction;
    actions: any[];
    sendMessage: (message: SSEMessage) => void;
    signal: AbortSignal;
}): Promise<{
    script: string;
    promptTokens: number;
    completionTokens: number;
}> {
    const { plan, actions, sendMessage, signal } = params;
    const deterministic = compileDetailedLongPlanDeterministically(plan);
    if (deterministic) {
        const parsed = parsePlanScript({
            script: deterministic.script,
            actions: actions.map((action: any) => ({
                id: action.id,
                name: action.name,
                type: action.type,
            })),
            allowPendingActions: true,
        });
        if (parsed.days.length !== plan.chunks.length * 7) {
            throw new Error(`确定性长计划解析结果不完整：应有 ${plan.chunks.length * 7} 天，实际 ${parsed.days.length} 天`);
        }
        sendMessage({
            type: "progress",
            message: `已忠实提取 ${plan.chunks.length} 周、${deterministic.actionCount} 条训练处方`,
        });
        return { script: deterministic.script, promptTokens: 0, completionTokens: 0 };
    }

    const fallback = getCoachlinkPlanScriptFallbackLlm();
    const parts = splitLongPlanWeeksForCompilation(plan);
    const compiled: Array<{ week: number; script: string }> = [];
    let promptTokens = 0;
    let completionTokens = 0;

    const compilePart = async (part: LongPlanCompilationPart) => {
        let lastError = "";
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                const result = await fallback.createText({
                    prompt: `把这部分逐条忠实转换成PlanScript，只输出W${part.week}和${part.dayRange}。休息日写Dn off；动作写中文原名 NxM @Nkg，每个训练处方独占一行，条件处方也不得省略或用斜杠合并。没有动作名的负重热身沿用“负重引体（底部暂停）”。不要解释。\n\n${part.text}`,
                    maxTokens: 1800,
                    timeoutMs: 60_000,
                    signal,
                });
                const script = normalizeCompiledPlanScriptPart(result.content, part.week);
                const parsed = parsePlanScript({
                    script,
                    actions: actions.map((action: any) => ({
                        id: action.id,
                        name: action.name,
                        type: action.type,
                    })),
                    allowPendingActions: true,
                });
                const actualDays = new Set(
                    parsed.days.map((day) => ((Number(day.dayIndex || 1) - 1) % 7) + 1),
                );
                const missingDays = parseDayRange(part.dayRange).filter((day) => !actualDays.has(day));
                if (missingDays.length > 0) {
                    throw new Error(`W${part.week} 缺少 ${missingDays.map((day) => `D${day}`).join("、")}`);
                }
                const expectedActions = countLongPlanActionPrescriptions(part.text);
                const actualActions = parsed.days.reduce(
                    (sum, day) => sum + (day.actionSets?.length || 0),
                    0,
                );
                if (actualActions < expectedActions) {
                    throw new Error(`W${part.week} ${part.dayRange} 动作不完整：应有 ${expectedActions} 条，实际 ${actualActions} 条`);
                }
                promptTokens += result.inputTokens;
                completionTokens += result.outputTokens;
                return { week: part.week, script };
            } catch (error: any) {
                lastError = error?.message || "分段计划脚本编译失败";
                signal.throwIfAborted();
                if (isDevelopment) {
                    console.warn(
                        `[batch-operation] W${part.week} ${part.dayRange} compile attempt ${attempt + 1} failed: ${lastError}`,
                    );
                }
                if (attempt < 3) {
                    sendMessage({
                        type: "progress",
                        message: `W${part.week} ${part.dayRange} 返回中断，正在进行第 ${attempt + 2} 次尝试`,
                    });
                    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
                }
            }
        }
        throw new Error(`W${part.week} ${part.dayRange} 编译失败：${lastError}`);
    };

    for (let index = 0; index < parts.length; index += 1) {
        const batch = parts.slice(index, index + 1);
        const ranges = batch.map((part) => `W${part.week} ${part.dayRange}`).join("、");
        sendMessage({ type: "progress", message: `正在分段编译 ${ranges}` });
        const results = await Promise.all(batch.map(compilePart));
        compiled.push(...results);
    }

    const script = mergeCompiledPlanScriptParts(compiled);
    const parsed = parsePlanScript({
        script,
        actions: actions.map((action: any) => ({
            id: action.id,
            name: action.name,
            type: action.type,
        })),
        allowPendingActions: true,
    });
    const maxWeek = parsed.days.reduce(
        (maximum, day) => Math.max(maximum, Math.ceil(Number(day.dayIndex || 0) / 7)),
        0,
    );
    const expectedMaxWeek = Math.max(...plan.chunks.map((chunk) => chunk.endWeek));
    if (maxWeek < expectedMaxWeek) throw new Error(`分段脚本合并后只包含到 W${maxWeek}`);
    return { script, promptTokens, completionTokens };
}

async function runPlanScriptPatchEdit(params: {
    openai: ReturnType<typeof getCoachlinkPlanLlm>["client"];
    llmModel: string;
    trainingDays: any[];
    actions: any[];
    effectiveInstruction: string;
    scopeInstruction: string;
    preferredDayIndexes?: number[];
    contextPrompt: string;
    sendMessage: (message: SSEMessage) => void;
    signal: AbortSignal;
}): Promise<PlanScriptEditResult> {
    const {
        openai,
        llmModel,
        trainingDays,
        actions,
        effectiveInstruction,
        scopeInstruction,
        preferredDayIndexes = [],
        contextPrompt,
        sendMessage,
        signal,
    } = params;
    const actionNameById = buildActionNameById(actions);
    const scope = selectPlanScriptPatchScope(scopeInstruction, trainingDays, actions, preferredDayIndexes);
    if (scope.days.length === 0) {
        return {
            success: false,
            error: `指令指定的修改范围在当前计划中没有命中（${scope.reason}）`,
        };
    }

    // 永远在自然周边界切段。同一周被拆开时，模型常会补全该周并回显相邻段的
    // dayIndex，导致一个有效长任务在最后被整单拒绝。
    const chunks = splitPlanScriptPatchChunks(scope.days, actionNameById);
    let updatedTrainingDays = trainingDays;
    const oneRmAdjustments: OneRmAdjustmentDraft[] = [];
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let changedPatchDays = 0;
    const startedAt = Date.now();
    const fallback = getCoachlinkPlanScriptFallbackLlm();

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const chunk = chunks[chunkIndex];
        const allowedDayIndexes = new Set(chunk.map((day) => Number(day?.dayIndex || 0)));
        const chunkScript = formatTemplateToPlanScript({
            trainingDays: chunk,
            actionNameById,
        });
        const relevantActionLibrary = buildPatchActionLibrary(actions, chunk, effectiveInstruction);
        // 调用方传入的是按段精简的上下文（学员关键数据、锁定、反馈在前），不再整体截断。
        const boundedContext = String(contextPrompt || "");
        const planWeekCount = Math.max(1, Math.ceil(trainingDays.length / 7));
        const patchPrompt = `你是 coachlink 的 PlanScript 局部补丁编辑器。请执行用户指令，但不要重写整份计划。

## 输出规则
- 只输出本段中实际发生变化的训练日，并且每个变化日要输出完整内容（Wn、Dn、备注、全部动作）。
- 没有变化时只输出 NO_CHANGE。
- 可输出全局 1RM 指令，例如：1RM 负重引体 = 50kg 或 1RM 负重引体 -= 2.5kg。
- 禁止输出 JSON、Markdown 代码块、解释和未变化的其他训练日。
- 不得输出本段以外的周/日；服务端会把补丁按 dayIndex 合并回原来的 ${planWeekCount} 周计划。
- 如果是训练日排期调整，必须同时输出被清空的源日（Dn off）和承接训练内容的目标日。
- 动作格式：动作名 4x7 @9rm r270 #备注；固定重量用 @60kg，百分比用 @75%。
- 未要求修改的参数、动作顺序和备注必须原样保留。

## 本段范围
${scope.reason}；第 ${chunkIndex + 1}/${chunks.length} 段；允许修改 dayIndex：${Array.from(allowedDayIndexes).join("、")}

## 本段相关动作库
${relevantActionLibrary}

${boundedContext ? `## 相关业务上下文（按段精简）\n${boundedContext}\n\n` : ""}## 当前本段 PlanScript
${chunkScript}

## 用户修改指令
${effectiveInstruction}`;

        sendMessage({
            type: "progress",
            message: chunks.length === 1
                ? `正在生成局部修改补丁（${scope.reason}）`
                : `正在生成局部修改补丁 ${chunkIndex + 1}/${chunks.length}`,
        });

        let rawContent = "";
        let lastParseError = "";
        const maxPatchAttempts = 3;
        for (let attempt = 0; attempt < maxPatchAttempts; attempt += 1) {
            const correction = lastParseError
                ? `\n\n上次输出无法解析：${lastParseError}。只允许输出 dayIndex ${Array.from(allowedDayIndexes).join("、")}；删除其他周/日后，严格按 Wn/Dn PlanScript 补丁格式重新输出。`
                : "";
            const messages = buildPromptMessages(patchPrompt + correction);
            const requestStartedAt = Date.now();
            if (isDevelopment) {
                console.log(
                    `[batch-operation] plan-script patch request: model=${attempt === maxPatchAttempts - 1 ? "fallback" : llmModel}, chunk=${chunkIndex + 1}/${chunks.length}, attempt=${attempt + 1}/${maxPatchAttempts}, promptChars=${messages.reduce((sum, message) => sum + message.content.length, 0)}, scopeDays=${chunk.length}, fullPlanDays=${trainingDays.length}`,
                );
            }

            try {
                if (attempt === maxPatchAttempts - 1 && lastParseError) {
                    sendMessage({
                        type: "progress",
                        message: "本段格式连续异常，正在切换独立模型修复输出",
                    });
                    const repaired = await fallback.createText({
                        prompt: patchPrompt + correction,
                        maxTokens: 7000,
                        timeoutMs: 90_000,
                        signal,
                    });
                    rawContent = repaired.content.trim();
                    promptTokens += repaired.inputTokens;
                    completionTokens += repaired.outputTokens;
                    totalTokens += repaired.inputTokens + repaired.outputTokens;
                } else {
                    const completion = await createChatCompletionWithRetry(openai, {
                        model: llmModel,
                        messages,
                        temperature: 0.1,
                        max_tokens: 7000,
                    }, signal);
                    rawContent = String(completion.choices?.[0]?.message?.content || "").trim();
                    promptTokens += completion.usage?.prompt_tokens || 0;
                    completionTokens += completion.usage?.completion_tokens || 0;
                    totalTokens += completion.usage?.total_tokens || 0;
                }
            } catch (error) {
                signal.throwIfAborted();
                if (isDevelopment) {
                    console.warn(
                        `[batch-operation] OpenAI patch channel failed: chunk=${chunkIndex + 1}/${chunks.length}, elapsedMs=${Date.now() - requestStartedAt}; switching to Wanjie Anthropic endpoint`,
                    );
                }
                sendMessage({
                    type: "progress",
                    message: `OpenAI 兼容通道连接中断，正在通过万界方舟 Anthropic 通道重试本段`,
                });
                const fallbackResult = await fallback.createText({
                    prompt: patchPrompt + correction,
                    maxTokens: 7000,
                    timeoutMs: 90_000,
                    signal,
                });
                rawContent = fallbackResult.content.trim();
                promptTokens += fallbackResult.inputTokens;
                completionTokens += fallbackResult.outputTokens;
                totalTokens += fallbackResult.inputTokens + fallbackResult.outputTokens;
            }

            if (/^NO[_\s-]?CHANGE[。.!！]?$/i.test(rawContent)) {
                lastParseError = "";
                break;
            }

            try {
                const patchScript = extractPlainPlanScript(rawContent);
                const parsed = parsePlanScript({
                    script: patchScript,
                    actions: actions.map((action: any) => ({
                        id: action.id,
                        name: action.name,
                        type: action.type,
                    })),
                    allowPendingActions: true,
                });
                const inScopeDays = parsed.days.filter(
                    (day) => allowedDayIndexes.has(Number(day?.dayIndex || 0)),
                );
                const outsideScopeDays = parsed.days.filter(
                    (day) => !allowedDayIndexes.has(Number(day?.dayIndex || 0)),
                );
                if (outsideScopeDays.length > 0 && inScopeDays.length === 0) {
                    throw new Error(`只返回了本段范围外的 dayIndex ${outsideScopeDays.map((day) => day.dayIndex).join("、")}`);
                }
                if (outsideScopeDays.length > 0) {
                    if (isDevelopment) {
                        console.warn(
                            `[batch-operation] ignored out-of-scope patch days: chunk=${chunkIndex + 1}/${chunks.length}, dayIndexes=${outsideScopeDays.map((day) => day.dayIndex).join(",")}`,
                        );
                    }
                    sendMessage({
                        type: "progress",
                        message: "已忽略本段边界外的重复日期，仅合并允许范围内的修改",
                    });
                }
                updatedTrainingDays = mergePlanScriptDayPatches(updatedTrainingDays, inScopeDays, actionNameById);
                changedPatchDays += inScopeDays.length;
                for (const adjustment of parsed.oneRmAdjustments) {
                    const key = `${adjustment.actionName}|${adjustment.targetOneRM ?? ""}|${adjustment.deltaKg ?? ""}`;
                    const exists = oneRmAdjustments.some((existing) =>
                        `${existing.actionName}|${existing.targetOneRM ?? ""}|${existing.deltaKg ?? ""}` === key,
                    );
                    if (!exists) oneRmAdjustments.push(adjustment);
                }
                lastParseError = "";
                break;
            } catch (error: any) {
                lastParseError = error?.message || "局部 PlanScript 无法解析";
            }
        }

        if (lastParseError) {
            const weeksInChunk = new Set(
                chunk.map((day) => getDayWeek(Number(day?.dayIndex || 0)).week),
            );
            if (weeksInChunk.size > 1) {
                const smallerChunks = splitPlanScriptPatchChunks(chunk, actionNameById, 1);
                if (smallerChunks.length > 1) {
                    sendMessage({
                        type: "progress",
                        message: `第 ${chunkIndex + 1} 段输出仍不稳定，已自动缩小为逐周补丁继续处理`,
                    });
                    chunks.splice(chunkIndex, 1, ...smallerChunks);
                    chunkIndex -= 1;
                    continue;
                }
            }
            return {
                success: false,
                error: `第 ${chunkIndex + 1} 段局部补丁解析失败：${lastParseError}`,
            };
        }
    }

    const originalScript = formatTemplateToPlanScript({ trainingDays, actionNameById });
    const updatedScript = formatTemplateToPlanScript({ trainingDays: updatedTrainingDays, actionNameById });
    if (
        normalizePlanScriptText(originalScript) === normalizePlanScriptText(updatedScript) &&
        oneRmAdjustments.length === 0
    ) {
        return {
            success: false,
            error: "局部补丁没有产生实际修改，请把要修改的周次、训练日或动作写得更明确",
        };
    }

    return {
        success: true,
        actionPlan: `已用局部 PlanScript 补丁完成修改，仅合并 ${changedPatchDays} 个训练日，未重写其余计划`,
        updatedTrainingDays,
        oneRmAdjustments,
        loadAdjustments: [],
        appliedLoadAdjustments: 0,
        promptTokens,
        completionTokens,
        totalTokens,
        duration: Date.now() - startedAt,
    };
}

async function runPlanScriptEdit(params: {
    openai: ReturnType<typeof getCoachlinkPlanLlm>["client"];
    llmModel: string;
    trainingDays: any[];
    actions: any[];
    effectiveInstruction: string;
    latestInstruction: string;
    preferredDayIndexes?: number[];
    contextPrompt: string;
    compactContextPrompt: string;
    deterministicReason?: string;
    sendMessage: (message: SSEMessage) => void;
    signal: AbortSignal;
}): Promise<PlanScriptEditResult> {
    const {
        openai,
        llmModel,
        trainingDays,
        actions,
        effectiveInstruction,
        latestInstruction,
        preferredDayIndexes = [],
        contextPrompt,
        compactContextPrompt,
        deterministicReason,
        sendMessage,
        signal,
    } = params;

    let currentScript: string;
    try {
        currentScript = formatTemplateToPlanScript({
            trainingDays,
            actionNameById: buildActionNameById(actions),
        });
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || "当前计划无法转换为计划脚本",
        };
    }

    const actionLibrary = buildPlanScriptActionLibrary(actions);
    const hasCurrentPlanScript = currentScript.trim().length > 0;
    const requestedWeeks = inferRequestedPlanWeeks(latestInstruction);
    const detailedLongPlan = requestedWeeks
        ? splitDetailedLongPlanInstruction(latestInstruction, requestedWeeks, 1)
        : null;
    const maxRetries = 2;
    const outputFormatPrompt = `## 输出格式（纯 PlanScript 模式）
- 只输出 PlanScript 纯文本；如有 1RM 指令先输出指令，随后从 W1 开始输出完整计划。
- 禁止输出 JSON、Markdown 代码块、解释、标题或总结。
${requestedWeeks ? `- 必须完整输出 W1 到 W${requestedWeeks}，不得使用“同上”“略”“依次类推”等省略写法。` : "- 必须返回修改后的完整计划，不得只返回差异片段。"}
- W 标记和 D 标记必须各自独占一行。
- 全局 1RM 绝对设定：\`1RM 负重引体 = 50kg #根据测试成绩设定\`。
- 全局 1RM 增减：\`1RM 负重引体 += 2.5kg #学员反馈较轻\`或 \`1RM 负重引体 -= 2.5kg #学员反馈较重\`。
- 1RM 指令放在 W1 之前；即使计划本身不需要改动，也必须输出完整计划。`;
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        {
            role: "system",
            content: "你是 coachlink 的训练计划脚本编辑器。你只输出 PlanScript 纯文本，不输出 JSON、Markdown 或额外说明。",
        },
        {
            role: "user",
            content: `请根据用户指令修改下面的计划脚本，并返回完整的新脚本。

## 计划脚本规则
- W1 表示第 1 周，D1 表示一周第 1 天，D1 off 表示休息日。
- 周标题和日标题默认分两行写：先写 \`W1\`，下一行再写 \`D1\`；不要合并成 \`W1 D1\`，除非确实无法避免。
- !开头表示当天备注，# 后面表示动作备注。
- 动作格式示例：负重引体（底部暂停） 4x7 @9rm r270。
- 4x7 表示 4 组 7 次，4x30s 表示 4 组 30 秒，@9rm 表示 9RM，r270 表示休息 270 秒。
- 必须保留完整计划，不能只返回被修改片段。
- ${hasCurrentPlanScript ? "除用户要求修改的地方外，其余周、天、动作顺序、备注和参数都必须保持不变。" : "当前计划为空时，本次任务等价于从零创建完整计划；请直接生成完整的周/天/动作脚本。"}
- 动作名必须使用动作库中的完整名称，尤其括号变体必须精确保留，例如“负重引体（底部暂停）”不能写成“负重引体”。
- 如果用户要求的新动作不在动作库中，直接在脚本中写用户指定的新动作名；系统会把它转为待确认动作，后续让用户选择“新建动作”或“映射已有动作”。
- 禁止把新动作硬匹配到相似旧动作；例如“窄距反手引体”不在库中时，保留“窄距反手引体”，不要改写成“反手引体”或其他相近动作。
- 如果用户表达“太重/太轻/做不了/过轻松”，且当前计划负荷依赖动作级全局 1RM，请在 W1 之前输出 \`1RM 动作名 += 2.5kg\` 或 \`1RM 动作名 -= 2.5kg\`。相对增减必须使用 2.5kg 的整数倍。
- 如果用户明确设置全局 1RM，输出 \`1RM 动作名 = 50kg\`；绝对值按用户要求精确设置，不做 2.5kg 步长取整。
- 如果用户要修改当前计划里的处方负荷，直接改动作行：固定重量写 \`@60kg\`，RM 写 \`@8rm\`，百分比写 \`@75%\`。不要输出 JSON 补丁或额外的数据结构。
- 即使只调整全局 1RM、计划结构不变，也要保留 1RM 指令并完整输出当前计划脚本。

## 可用动作库
${actionLibrary}

## 额外业务上下文
${contextPrompt}

## 当前计划脚本
${hasCurrentPlanScript ? `\`\`\`plan
${currentScript}
\`\`\`` : "（当前计划为空，请根据用户指令直接创建完整计划脚本。）"}

## 用户指令
${effectiveInstruction}
${deterministicReason ? `\n\n## 已尝试的明确规则未命中原因\n${deterministicReason}` : ""}

${outputFormatPrompt}`,
        },
    ];

    let lastError = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    const startedAt = Date.now();

    if (detailedLongPlan) {
        sendMessage({
            type: "progress",
            message: `检测到已完整写明的 ${requestedWeeks} 周计划，正在忠实提取并校验全部处方`,
        });
        if (isDevelopment) {
            console.log(
                `[batch-operation] detailed long-plan compiler: weeks=${requestedWeeks}, inputChars=${effectiveInstruction.length}, chunks=${detailedLongPlan.chunks.length}`,
            );
        }
        const compiled = await compileDetailedLongPlanInChunks({
            plan: detailedLongPlan,
            actions,
            sendMessage,
            signal,
        });
        const parsed = parsePlanScript({
            script: compiled.script,
            actions: actions.map((action: any) => ({
                id: action.id,
                name: action.name,
                type: action.type,
            })),
            allowPendingActions: true,
        });
        return {
            success: true,
            actionPlan: `已将用户提供的 ${requestedWeeks} 周详细计划忠实解析并完整合并`,
            updatedTrainingDays: parsed.days,
            oneRmAdjustments: parsed.oneRmAdjustments,
            loadAdjustments: [],
            appliedLoadAdjustments: 0,
            promptTokens: compiled.promptTokens,
            completionTokens: compiled.completionTokens,
            totalTokens: compiled.promptTokens + compiled.completionTokens,
            duration: Date.now() - startedAt,
        };
    }

    if (hasCurrentPlanScript) {
        return runPlanScriptPatchEdit({
            openai,
            llmModel,
            trainingDays,
            actions,
            effectiveInstruction,
            scopeInstruction: latestInstruction,
            preferredDayIndexes,
            contextPrompt: compactContextPrompt,
            sendMessage,
            signal,
        });
    }

    for (let retry = 0; retry < maxRetries; retry++) {
        sendMessage({
            type: "progress",
            message: retry === 0 ? "正在用计划脚本生成修改方案" : "正在微调计划脚本",
        });

        const requestStartedAt = Date.now();
        if (isDevelopment) {
            console.log(
                `[batch-operation] plan-script request: model=${llmModel}, attempt=${retry + 1}/${maxRetries}, promptChars=${messages.reduce((sum, message) => sum + message.content.length, 0)}, currentScriptChars=${currentScript.length}, contextChars=${contextPrompt.length}, requestedWeeks=${requestedWeeks ?? "unspecified"}`,
            );
        }
        let completion: any;
        try {
            const requestBody: Record<string, unknown> = {
                model: llmModel,
                messages,
                temperature: 0.1,
                max_tokens: 12000,
            };
            completion = await createChatCompletionWithRetry(openai, requestBody, signal);
        } catch (error) {
            if (isDevelopment) {
                console.warn(
                    `[batch-operation] plan-script request failed: model=${llmModel}, elapsedMs=${Date.now() - requestStartedAt}`,
                );
            }
            throw error;
        }

        promptTokens += completion.usage?.prompt_tokens || 0;
        completionTokens += completion.usage?.completion_tokens || 0;
        totalTokens += completion.usage?.total_tokens || 0;

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
            lastError = "AI 未返回有效脚本";
        } else {
            try {
                const nextScript = extractPlainPlanScript(responseContent);

                if (!nextScript.trim()) {
                    throw new Error("AI 未返回有效 PlanScript");
                }

                const parsed = parsePlanScript({
                    script: nextScript,
                    actions: actions.map((action: any) => ({
                        id: action.id,
                        name: action.name,
                        type: action.type,
                    })),
                    allowPendingActions: true,
                });
                const oneRmAdjustments = parsed.oneRmAdjustments;

                if (
                    normalizePlanScriptText(nextScript) === normalizePlanScriptText(currentScript) &&
                    oneRmAdjustments.length === 0
                ) {
                    throw new Error("AI 返回的计划脚本与原脚本相同，没有实际修改");
                }

                if (requestedWeeks) {
                    const parsedMaxWeek = parsed.days.reduce(
                        (maxWeek, day) => Math.max(maxWeek, Math.ceil(Number(day.dayIndex || 0) / 7)),
                        0,
                    );
                    if (parsedMaxWeek < requestedWeeks) {
                        throw new Error(
                            `用户要求 ${requestedWeeks} 周计划，但模型脚本只包含到第 ${parsedMaxWeek || 0} 周`,
                        );
                    }
                }

                return {
                    success: true,
                    actionPlan: "已根据计划脚本完成修改",
                    updatedTrainingDays: parsed.days,
                    oneRmAdjustments,
                    loadAdjustments: [],
                    appliedLoadAdjustments: 0,
                    promptTokens,
                    completionTokens,
                    totalTokens,
                    duration: Date.now() - startedAt,
                };
            } catch (error: any) {
                lastError = error?.message || "计划脚本解析失败";
                messages.push(
                    { role: "assistant", content: responseContent },
                    {
                        role: "user",
                        content: `上一次返回的纯 PlanScript 不完整、无法编译或没有实际修改：${lastError}\n请重新输出完整可编译的 PlanScript${requestedWeeks ? `，必须覆盖 W1 到 W${requestedWeeks}` : ""}。只输出脚本，禁止 JSON、Markdown、解释或省略。`,
                    },
                );
            }
        }
    }

    return {
        success: false,
        error: lastError || "计划脚本修改失败",
        promptTokens,
        completionTokens,
        totalTokens,
        duration: Date.now() - startedAt,
    };
}

/**
 * SSE 流式批量操作接口
 */
export async function POST(req: NextRequest) {
    // 验证用户身份
    const session = await getServerSession();
    const userId = session?.user?.id;

    if (!userId) {
        return new Response(
            JSON.stringify({ success: false, message: "Unauthorized" }),
            { status: 401 }
        );
    }

    try {
        const body = await req.json() as BatchOperationDto;
        const {
            templateId,
            trainingDays: providedTrainingDays,
            instruction,
            conversationHistory = [],
            modificationContext = [],
            targetActionType = "coach",
            contextOptions,
            previewInputOnly = false,
            editEngine = "auto",
        } = body;

        if (targetActionType === "coach" && !session.user.is_coach) {
            return new Response(
                JSON.stringify({ success: false, message: "Forbidden" }),
                { status: 403 },
            );
        }

        if (!String(instruction ?? "").trim() && !previewInputOnly) {
            return new Response(
                JSON.stringify({ success: false, message: "instruction 不能为空" }),
                { status: 400 },
            );
        }

        const currentInstruction = String(instruction || '').trim();
        const conversationTranscript = conversationHistory.length === 0
            ? '（无历史消息）'
            : conversationHistory.map(
                (turn) => `【${turn.role === 'assistant' ? '助手' : '用户'}】\n${turn.content}`,
            ).join('\n\n');
        const modificationContextPrompt = buildModificationContextPrompt(modificationContext);
        const assistantBackground = conversationHistory
            .filter((turn) => turn.role === 'assistant')
            .slice(-3)
            .map((turn) => turn.content)
            .join('\n\n');
        const effectiveModificationInstruction = [
            `【当前轮唯一需要执行的修改指令】\n${currentInstruction}`,
            assistantBackground ? `【此前助手摘要，仅用于理解“继续/这些/刚才”等指代，禁止重复执行历史指令】\n${assistantBackground}` : '',
            modificationContext.length > 0 ? `【当前草稿已有变化，仅用于理解指代】\n${modificationContextPrompt}` : '',
        ].filter(Boolean).join('\n\n');

        return createPlanEditSseResponse(req.signal, async ({ sendMessage, signal }) => {
                    const startTime = Date.now();

                    // 1. 获取训练计划（template 模式）或使用前端传入草稿（local 模式）
                    sendMessage({ type: 'progress', message: '正在加载训练计划' });
                    let originalTrainingDays: any[] = [];
                    let trainingDays: any[] = [];

                    if (templateId) {
                        const { table: planTable, ownerColumn: planOwnerColumn } =
                            getPlanOwnerConfig(targetActionType);
                        const { data: template, error: templateError } = await supabase
                            .from(planTable)
                            .select('*')
                            .eq('id', templateId)
                            .eq(planOwnerColumn, userId)
                            .single();

                        if (templateError || !template) {
                            throw new Error('无法找到训练计划模板');
                        }

                        originalTrainingDays = JSON.parse(JSON.stringify(template.training_days || []));
                        trainingDays = JSON.parse(JSON.stringify(template.training_days || []));
                    } else {
                        if (!Array.isArray(providedTrainingDays)) {
                            throw new Error('local 模式缺少 trainingDays');
                        }
                        originalTrainingDays = JSON.parse(JSON.stringify(providedTrainingDays || []));
                        trainingDays = JSON.parse(JSON.stringify(providedTrainingDays || []));
                    }

                    // 2. 获取教练的所有动作库
                    sendMessage({ type: 'progress', message: '正在加载动作库' });
                    
                    const { table: actionTable, ownerColumn: actionOwnerColumn } =
                        getActionOwnerConfig(targetActionType);
                    const { data: actionsData, error: actionsError } = await supabase
                        .from(actionTable)
                        .select('id, name, type, detail, canonical_action_id')
                        .eq(actionOwnerColumn, userId);

                    if (actionsError) {
                        throw new Error('无法加载动作库');
                    }

                    const actions = actionsData || [];
                    const shouldUsePlanScriptEngine =
                        editEngine === "plan_script" || editEngine === "auto";

                    // 按类型分组的动作列表，供 AI prompt 使用
                    const actionsByType = {
                        STRENGTH: (actions as any[]).filter((a: any) => !a.type || a.type === 'STRENGTH'),
                        CARDIO: (actions as any[]).filter((a: any) => a.type === 'CARDIO'),
                        DIET: (actions as any[]).filter((a: any) => a.type === 'DIET'),
                        HABIT: (actions as any[]).filter((a: any) => a.type === 'HABIT'),
                    };
                    const actionsByTypePrompt = `
## 四类动作的可选动作（供选择或新建参考）
1. **力量训练 (STRENGTH)**：${actionsByType.STRENGTH.length > 0 ? actionsByType.STRENGTH.map((a: any) => a.name).join('、') : '（暂无）'}；可新建如深蹲、硬拉、卧推等
2. **有氧运动 (CARDIO)**：${actionsByType.CARDIO.length > 0 ? actionsByType.CARDIO.map((a: any) => a.name).join('、') : '（暂无）'}；可新建如跑步、跳绳、骑行、游泳等
3. **饮食建议 (DIET)**：${actionsByType.DIET.length > 0 ? actionsByType.DIET.map((a: any) => a.name).join('、') : '（暂无）'}；可新建如早餐、加餐、蛋白质摄入等
4. **习惯打卡 (HABIT)**：${actionsByType.HABIT.length > 0 ? actionsByType.HABIT.map((a: any) => a.name).join('、') : '（暂无）'}；可新建如冥想、早起、饮水等

用户可从上述动作库中选择，也可创建新动作（需先在动作库中添加）。`;

                    let planScriptBody: string | null = null;
                    let planScriptUnavailableReason: string | null = null;
                    if (shouldUsePlanScriptEngine) {
                        try {
                            planScriptBody = formatTemplateToPlanScript({
                                trainingDays,
                                actionNameById: buildActionNameById(actions),
                            });
                        } catch (error: any) {
                            planScriptUnavailableReason = error?.message || "当前计划无法转换为计划脚本";
                        }
                    }

                    const includePlanBody = contextOptions?.includePlanBody ?? true;
                    const includeActionLibrary = contextOptions?.includeActionLibrary ?? true;
                    const planBodyPrompt = includePlanBody
                        ? (planScriptBody !== null
                            ? (planScriptBody.trim()
                                ? `（计划脚本格式，已由 training_days 编译而来）\n${planScriptBody}`
                                : '（当前计划为空，AI 可根据用户要求从零创建完整计划脚本）')
                            : JSON.stringify(trainingDays, null, 2))
                        : '（已关闭：计划/模板本体上下文）';
                    const actionLibraryPrompt = includeActionLibrary
                        ? `${actions.map(a => `- ${a.name} (type: ${a.type})`).join('\n')}\n${actionsByTypePrompt}`
                        : '（已关闭：动作库与类型说明上下文）';
                    const actionLibraryCompactPrompt = includeActionLibrary
                        ? `${actions.map(a => `${a.name} (${a.type})`).join('、')}\n${actionsByTypePrompt}`
                        : '（已关闭：动作库与类型说明上下文）';
                    const actionLibraryForSystemPrompt = includeActionLibrary
                        ? `${actions.map(a => `- ${a.name} (id: ${a.id}, type: ${a.type})`).join('\n')}\n${actionsByTypePrompt}`
                        : '（已关闭：动作库与类型说明上下文）';

                    sendMessage({ type: 'progress', message: '正在构建上下文信息' });
                    const contextBuild = await buildBatchOperationContext({
                        userId,
                        targetActionType,
                        templateId,
                        contextOptions,
                        supabase,
                        actions,
                    });
                    // 基线上下文只给“仅预览输入”对比开关效果用，正常修改轮不必再查一遍。
                    const baselineContextBuild = !previewInputOnly
                        ? null
                        : await buildBatchOperationContext({
                            userId,
                            targetActionType,
                            templateId,
                            contextOptions: {
                                subscriptionId: contextOptions?.subscriptionId,
                                includeStudentProfile: false,
                                includeStudentQuestionnaire: false,
                                includeExecutionHistory: false,
                                includeStudentActionLib: false,
                                includeCoachActionLib: false,
                                includePublicActionLib: false,
                                includeCoachTemplates: false,
                                includeTemplateMatch: false,
                                includeFeedbacks: false,
                            },
                            supabase,
                        });
                    const contextPrompt = contextBuild.prompt;
                    const compactContextPrompt = contextBuild.compactPrompt;
                    const lockedThroughDayIndex = normalizeLockedThroughDayIndex(contextOptions?.lockedThroughDayIndex);
                    const fixedInjected = [
                        '用户指令',
                        ...(includePlanBody ? ['计划/模板本体'] : []),
                        ...(includeActionLibrary ? ['动作库与类型说明'] : []),
                    ];
                    const addedByContextToggle = baselineContextBuild
                        ? contextBuild.enabled.filter((x) => !baselineContextBuild.enabled.includes(x))
                        : [];
                    sendMessage({
                        type: 'context_applied',
                        enabled: contextBuild.enabled,
                        unavailable: contextBuild.unavailable,
                        message: `已启用上下文 ${contextBuild.enabled.length} 项`,
                    });

                    /**
                     * 三条修改链路（明确规则 / PlanScript / 代码）的统一收尾：规范成编辑器口径、
                     * 还原已训练日的结构改动、计算真实差异；计划和 1RM 都没变时不报成功。
                     */
                    const finishModificationTurn = async (result: {
                        updatedTrainingDays: any[];
                        oneRmDrafts?: OneRmAdjustmentDraft[];
                        resolvedOneRm?: { adjustments: OneRmAdjustmentPreview[]; hasSubject: boolean };
                        resultMessage: (modificationCount: number, oneRmCount: number) => string;
                        newActionsHint: string;
                    }) => {
                        const normalizedDays = normalizeTrainingDaysForEditor(
                            result.updatedTrainingDays || [],
                            actions,
                            trainingDays,
                        );
                        // 两边都按编辑器口径比较；只规范化结果会把补 itemType、weight→load 这类改写当成修改。
                        // 发给前端的 originalTrainingDays 仍是原样，模板应用前的版本比对依赖它。
                        const normalizedOriginal = normalizeTrainingDaysForEditor(originalTrainingDays, actions, originalTrainingDays);
                        const locked = mergeLockedPlanDays({
                            savedDays: normalizedOriginal,
                            nextDays: normalizedDays,
                            lockedThroughDayIndex,
                        });
                        const updatedDays = locked.days;
                        const modifications = analyzeModifications(normalizedOriginal, updatedDays, actions);
                        const oneRm = result.resolvedOneRm ?? await resolveOneRmPreviewAdjustments({
                            drafts: result.oneRmDrafts,
                            userId,
                            targetActionType,
                            contextOptions,
                            actions,
                        });
                        const unresolvedOneRmNames = findUnresolvedOneRmDrafts(result.oneRmDrafts, oneRm.adjustments);
                        const lockNote = locked.restoredDayIndexes.length > 0
                            ? `第${locked.restoredDayIndexes.join('、')}天已有训练记录，本轮对这些天的增删/调换动作或训练/休息切换已还原；${describeLockedRange(lockedThroughDayIndex)}只能调整参数。`
                            : '';

                        const noChange = describeNoChangeTurn({
                            modificationCount: modifications.length,
                            resolvedOneRmCount: oneRm.adjustments.length,
                            unresolvedOneRmNames,
                            hasOneRmSubject: oneRm.hasSubject,
                        });
                        if (noChange) {
                            sendMessage({
                                type: 'need_clarification',
                                question: lockNote ? `${lockNote}${noChange}` : noChange,
                            });
                            return;
                        }

                        const knownActionIds = new Set(actions.map((a: any) => a.id));
                        const pendingActions = collectPendingActions(updatedDays, knownActionIds);
                        const newActionsDetected: NewActionDetected[] = pendingActions.map((p) => ({
                            actionId: p.tempActionId,
                            suggestedName: p.suggestedName,
                        }));
                        if (newActionsDetected.length > 0) {
                            const namesList = newActionsDetected
                                .map((a) => a.suggestedName || a.actionId)
                                .join('、');
                            sendMessage({
                                type: 'new_actions_detected',
                                actions: newActionsDetected,
                                message: `修改计划中包含以下不在您动作库中的动作：${namesList}。${result.newActionsHint}`,
                            });
                        }

                        const notes = [
                            lockNote,
                            unresolvedOneRmNames.length > 0
                                ? `${unresolvedOneRmNames.join('、')} 的 1RM 调整未生效（${oneRm.hasSubject ? '没有找到当前 1RM 或动作对不上' : '当前没有关联学员'}）。`
                                : '',
                        ].filter(Boolean);
                        sendMessage({
                            type: 'assistant_message',
                            content: [buildModificationSummary(modifications), ...notes].join('\n'),
                        });
                        sendMessage({
                            type: 'preview_result',
                            success: true,
                            originalTrainingDays,
                            updatedTrainingDays: updatedDays,
                            modifications,
                            pendingActions,
                            oneRmAdjustments: oneRm.adjustments,
                            restoredLockedDayIndexes: locked.restoredDayIndexes,
                            message: `${result.resultMessage(modifications.length, oneRm.adjustments.length)}${isDevelopment ? ` (总耗时 ${Date.now() - startTime}ms)` : ''}`,
                        });
                    };

                    if (previewInputOnly) {
                        const previewIntentPrompt = `你是一个训练计划助手。请分析用户的指令，判断他们是想要：
1. **查询/分析** - 想了解计划中的某些信息，如统计数据、动作分布、强度分析等（不修改计划）
2. **修改** - 想要对计划进行更改、替换、添加、删除等操作

## 当前训练计划概览
- 总天数: ${trainingDays.length} 天
- 训练天数: ${trainingDays.filter((d: any) => d.type === 'training').length} 天
- 休息天数: ${trainingDays.filter((d: any) => d.type === 'rest').length} 天

## 计划详情
${planBodyPrompt}

## 可用的动作列表
${actionLibraryPrompt}

## 额外上下文（档案/问卷/执行/模板）
${contextPrompt}

## 用户当前消息
${currentInstruction}

请返回 JSON 格式:
{
    "intent": "query" 或 "modify",
    "reason": "简短说明判断依据"
}`;

                        const previewQueryPrompt = `你是一个专业的训练计划分析师。请根据用户的问题，分析训练计划并给出详细回答。

## 当前训练计划数据
\`\`\`json
${planBodyPrompt}
\`\`\`

## 可用的动作列表（包含类型）
${actionLibraryPrompt}

## 动作类型说明
- STRENGTH: 力量训练
- CARDIO: 有氧运动
- DIET: 饮食相关
- HABIT: 习惯养成

## 额外上下文（档案/问卷/执行/模板）
${contextPrompt}

## 对话历史
${conversationTranscript}

## 用户当前问题
${currentInstruction}

## 当前待确认修改差异
${modificationContextPrompt}

请用中文回答，格式要清晰易读。如果涉及统计，请给出具体数字。可以使用 markdown 格式（如列表、加粗等）来增强可读性。`;

                        const previewClarificationPrompt = `你是一个训练计划助手。请判断用户的修改指令是否**信息完整**，能否直接执行。

## 判断规则（以下情况视为信息不完整，需向用户追问）
- 用户说「改为有氧」「换成有氧」「改成有氧」等，但**没有指定具体是哪种有氧运动**（如跑步、跳绳、骑行等）→ 不完整
- 用户说「替换为力量动作」「改成力量」等，但**没有指定具体动作名称** → 不完整
- 用户说「改成 CARDIO」或「改为有氧类」但未说明具体动作 → 不完整
- 其他：指令中仅提到**类别**（有氧/力量等）而未给出**具体动作名**时 → 不完整

## 当前动作库（供你判断用户是否可能从库中选）
${actionLibraryCompactPrompt}

## 额外上下文（档案/问卷/执行/模板）
${contextPrompt}

## 用户当前指令
${currentInstruction}`;

                        const previewSystemPrompt = `你是一个训练计划批量操作助手。

## 你的任务
根据用户的自然语言指令，生成 TypeScript 代码来修改训练计划。

## 当前可用的动作列表（仅允许使用以下 id）
${actionLibraryForSystemPrompt}

## 业务上下文（必须参考）
${contextPrompt}

## trainingDays 当前内容示例
${includePlanBody ? JSON.stringify(trainingDays.slice(0, 2), null, 2) : '（已关闭：计划/模板本体上下文）'}

## 用户当前指令
${effectiveModificationInstruction}`;

                        sendMessage({
                            type: 'ai_input_snapshot',
                            message: '仅预览模式：以下为将发送给模型的完整提示词',
                            fixedInjected,
                            baselineEnabledContext: baselineContextBuild?.enabled || [],
                            currentEnabledContext: contextBuild.enabled,
                            addedByContextToggle,
                            baselineContextPrompt: baselineContextBuild?.prompt || '',
                            currentContextPrompt: contextPrompt,
                            fullPrompts: {
                                intentPrompt: previewIntentPrompt,
                                queryPrompt: previewQueryPrompt,
                                clarificationPrompt: previewClarificationPrompt,
                                systemPrompt: previewSystemPrompt,
                            },
                        });
                        return;
                    }

                    // 首先让 AI 判断用户意图
                    sendMessage({ type: 'progress', message: '正在分析您的需求' });

                    const intentPrompt = `你是一个训练计划助手。请仅根据用户的指令，判断他们是想要：
1. **查询/分析** - 想了解计划中的某些信息，如统计数据、动作分布、强度分析等（不修改计划）
2. **修改** - 想要对计划进行更改、替换、添加、删除等操作

## 对话历史（只用于理解上下文）
${conversationTranscript}

## 用户当前消息（以此判断本轮意图）
${currentInstruction}

请返回 JSON 格式:
{
    "intent": "query" 或 "modify",
    "reason": "简短说明判断依据"
}`;

                    const { client: openai, model: llmModel, provider: llmProvider } = getCoachlinkPlanLlm();
                    const { client: fastOpenai, model: fastLlmModel } = getCoachlinkFastLlm();
                    const { client: planScriptOpenai, model: planScriptLlmModel } = getCoachlinkPlanScriptLlm();
                    if (isDevelopment) {
                        console.log(`[batch-operation] LLM: ${llmProvider} / ${llmModel}; plan-script / ${planScriptLlmModel}`);
                    }
                    const requestedWeeksForRouting = inferRequestedPlanWeeks(currentInstruction);
                    const detailedLongPlanForRouting = requestedWeeksForRouting
                        ? splitDetailedLongPlanInstruction(currentInstruction, requestedWeeksForRouting, 1)
                        : null;
                    let intentCompletion: any = null;
                    const localIntent = classifyBatchInstructionLocally(currentInstruction);
                    let userIntent: 'query' | 'modify' = localIntent || 'modify';
                    if (detailedLongPlanForRouting) {
                        sendMessage({
                            type: 'progress',
                            message: `已识别完整 ${requestedWeeksForRouting} 周计划，跳过大模型意图判断`,
                        });
                    } else if (localIntent) {
                        sendMessage({
                            type: 'progress',
                            message: localIntent === 'modify'
                                ? '已在本地识别为计划修改，无需请求模型判断意图'
                                : '已在本地识别为计划查询',
                        });
                    } else {
                        intentCompletion = await createJsonChatCompletionWithRetry(fastOpenai, {
                            model: fastLlmModel,
                            messages: buildPromptMessages(intentPrompt),
                            response_format: { type: "json_object" },
                            temperature: 0.1,
                            max_tokens: 2000
                        }, signal);

                        const intentContent = intentCompletion.choices[0]?.message?.content;
                        let parsedIntent: unknown = null;
                        try {
                            parsedIntent = intentContent ? JSON.parse(intentContent)?.intent : null;
                        } catch {
                            // 模型偶发返回非 JSON；按修改处理，后续还有完整性检查和“无实际修改”保护。
                        }
                        userIntent = parsedIntent === 'query' ? 'query' : 'modify';
                    }

                    // 根据意图走不同流程
                    if (userIntent === 'query') {
                        // 查询模式：让 AI 分析并回答
                        sendMessage({ type: 'progress', message: '正在分析训练计划' });

                        const queryPrompt = `你是一个专业的训练计划分析师。请根据用户的问题，分析训练计划并给出详细回答。

## 当前训练计划数据
\`\`\`json
${planBodyPrompt}
\`\`\`

## 可用的动作列表（包含类型）
${actionLibraryPrompt}

## 动作类型说明
- STRENGTH: 力量训练
- CARDIO: 有氧运动
- DIET: 饮食相关
- HABIT: 习惯养成

## 额外上下文（档案/问卷/执行/模板）
${contextPrompt}

## 对话历史
${conversationTranscript}

## 用户当前问题
${currentInstruction}

## 当前待确认修改差异
${modificationContextPrompt}

请用中文回答，格式要清晰易读。如果涉及统计，请给出具体数字。可以使用 markdown 格式（如列表、加粗等）来增强可读性。`;

                        const queryCompletion = await createChatCompletionWithRetry(openai, {
                            model: llmModel,
                            messages: buildPromptMessages(queryPrompt),
                            temperature: 0.3,
                            max_tokens: 6000
                        }, signal);

                        const queryAnswer = queryCompletion.choices[0]?.message?.content || '无法分析该问题';
                        const totalDuration = Date.now() - startTime;

                        // 发送统计信息（开发模式）
                        if (isDevelopment) {
                            const totalTokens = (intentCompletion?.usage?.total_tokens || 0) + (queryCompletion.usage?.total_tokens || 0);
                            sendMessage({
                                type: 'stats',
                                tokenUsage: {
                                    prompt: (intentCompletion?.usage?.prompt_tokens || 0) + (queryCompletion.usage?.prompt_tokens || 0),
                                    completion: (intentCompletion?.usage?.completion_tokens || 0) + (queryCompletion.usage?.completion_tokens || 0),
                                    total: totalTokens
                                },
                                duration: totalDuration
                            });
                        }

                        // 发送查询结果
                        sendMessage({
                            type: 'query_result',
                            answer: queryAnswer
                        });

                        return; // 查询模式结束，不执行修改逻辑
                    }

                    // 修改模式：先检查用户指令是否信息完整
                    sendMessage({ type: 'progress', message: '正在检查指令是否完整' });
                    const clarificationPrompt = `你是一个训练计划助手。请判断用户的修改指令是否**信息完整**，能否直接执行。

## 判断规则（以下情况视为信息不完整，需向用户追问）
- 用户说「改为有氧」「换成有氧」「改成有氧」等，但**没有指定具体是哪种有氧运动**（如跑步、跳绳、骑行等）→ 不完整
- 用户说「替换为力量动作」「改成力量」等，但**没有指定具体动作名称** → 不完整
- 用户说「改成 CARDIO」或「改为有氧类」但未说明具体动作 → 不完整
- 其他：指令中仅提到**类别**（有氧/力量等）而未给出**具体动作名**时 → 不完整

## 若信息完整（以下情况一律返回 complete: true，不要追问）
- 用户已明确写出**替换目标的具体动作名**
- 仅做组数/次数/重量/休息等参数调整，不涉及替换动作类型
- 删除/添加时已写明具体动作名

**关键**：只要用户写出了「换成/改为/替换为 + 具体动作名」（如跑步、跳绳、硬拉、高位下拉等），即视为完整，**不要**再追问「请说明要改成哪种有氧运动」。

## 当前动作库（供你判断用户是否可能从库中选）
${actionLibraryCompactPrompt}

## 用户当前修改指令
${currentInstruction}

请严格返回 JSON（不要其他内容）:
{
    "complete": true 或 false,
    "clarificationQuestion": "若 complete 为 false，此处写一句简短的中文追问，例如：请说明要改成哪种具体的有氧运动（如跑步、跳绳、骑行等）？",
    "suggestions": ["若 complete 为 false，此处返回 3～6 个具体推荐选项的字符串数组，与追问内容对应。例如有氧类可填 [\"跑步\", \"跳绳\", \"骑行\", \"游泳\", \"划船\"]，力量类可填动作库中的具体动作名。用户可点击直接选用。"]
                    }`;
                    let clarificationResult: { complete?: boolean; clarificationQuestion?: string; suggestions?: string[] } = { complete: true };
                    const skipClarification = detailedLongPlanForRouting || canSkipModificationClarification(currentInstruction);
                    if (!skipClarification) {
                        const clarificationCompletion = await createJsonChatCompletionWithRetry(fastOpenai, {
                            model: fastLlmModel,
                            messages: buildPromptMessages(clarificationPrompt),
                            response_format: { type: "json_object" },
                            temperature: 0.1,
                            max_tokens: 3000
                        }, signal);
                        const clarificationContent = clarificationCompletion.choices[0]?.message?.content;
                        if (clarificationContent) {
                            try {
                                clarificationResult = JSON.parse(clarificationContent);
                            } catch (_) {}
                        }
                    } else if (!detailedLongPlanForRouting) {
                        sendMessage({
                            type: 'progress',
                            message: '指令已包含可执行的修改信息，无需额外请求模型确认完整性',
                        });
                    }
                    const suggestions = Array.isArray(clarificationResult.suggestions)
                        ? clarificationResult.suggestions.filter((s: unknown) => typeof s === 'string').slice(0, 8)
                        : undefined;
                    if (clarificationResult.complete === false && clarificationResult.clarificationQuestion) {
                        sendMessage({
                            type: 'need_clarification',
                            question: clarificationResult.clarificationQuestion,
                            ...(suggestions?.length ? { suggestions } : {})
                        });
                        return;
                    }

                    const deterministicResult = tryApplyDeterministicBatchEdit({
                        instruction: currentInstruction,
                        trainingDays,
                        actions: actions as Array<{ id: string; name: string; type?: ItemType | string | null }>,
                    });

                    if (deterministicResult.applied) {
                        sendMessage({ type: 'progress', message: '已按明确规则直接应用修改' });
                        sendMessage({
                            type: 'action_plan',
                            plan: deterministicResult.actionPlan || '已根据明确规则应用批量修改',
                        });
                        await finishModificationTurn({
                            updatedTrainingDays: deterministicResult.updatedTrainingDays || [],
                            resolvedOneRm: { adjustments: [], hasSubject: true },
                            resultMessage: (count) => `分析完成，共发现 ${count} 处修改`,
                            newActionsHint: '请先在动作库中创建这些动作后再应用，或确认是否仍要应用计划。',
                        });
                        return;
                    }

                    if (deterministicResult.matched && deterministicResult.terminal) {
                        sendMessage({
                            type: 'need_clarification',
                            question: deterministicResult.reason || '已识别为周内排期调整，但当前计划无法安全执行。请确认原训练日和目标训练日。',
                        });
                        return;
                    }

                    if (shouldUsePlanScriptEngine) {
                        if (planScriptBody === null) {
                            const reason = planScriptUnavailableReason || "当前计划无法转换为计划脚本";
                            if (editEngine === "plan_script") {
                                throw new Error(`脚本编辑引擎暂不可用：${reason}`);
                            }
                            sendMessage({ type: "progress", message: `计划脚本不可用，已回退旧引擎：${reason}` });
                        } else {
                            const scriptResult = await runPlanScriptEdit({
                                openai: planScriptOpenai,
                                llmModel: planScriptLlmModel,
                                trainingDays,
                                actions,
                                effectiveInstruction: effectiveModificationInstruction,
                                latestInstruction: currentInstruction,
                                preferredDayIndexes: Array.from(new Set(modificationContext.map((item) => item.dayIndex))),
                                contextPrompt,
                                compactContextPrompt,
                                deterministicReason: deterministicResult.matched ? deterministicResult.reason : undefined,
                                sendMessage,
                                signal,
                            });

                            if (scriptResult.success && scriptResult.updatedTrainingDays) {
                                sendMessage({
                                    type: "action_plan",
                                    plan: scriptResult.actionPlan || "已根据计划脚本完成修改",
                                });
                                if (isDevelopment && scriptResult.totalTokens) {
                                    sendMessage({
                                        type: "stats",
                                        tokenUsage: {
                                            prompt: scriptResult.promptTokens || 0,
                                            completion: scriptResult.completionTokens || 0,
                                            total: scriptResult.totalTokens || 0,
                                        },
                                        duration: scriptResult.duration,
                                    });
                                }

                                await finishModificationTurn({
                                    updatedTrainingDays: scriptResult.updatedTrainingDays,
                                    oneRmDrafts: scriptResult.oneRmAdjustments,
                                    resultMessage: (count, oneRmCount) =>
                                        `脚本编辑完成，共发现 ${count} 处修改${scriptResult.appliedLoadAdjustments ? `，并结构化应用 ${scriptResult.appliedLoadAdjustments} 条负荷调整` : ""}${oneRmCount > 0 ? `，并调整 ${oneRmCount} 个动作的全局1RM` : ""}`,
                                    newActionsHint: '可以先确认并创建这些动作，再应用计划。',
                                });
                                return;
                            }

                            if (editEngine === "plan_script") {
                                throw new Error(scriptResult.error || "计划脚本修改失败");
                            }

                            sendMessage({
                                type: "progress",
                                message: `计划脚本未能完成修改，已回退旧引擎：${scriptResult.error || "未知原因"}`,
                            });
                        }
                    }

                    // 代码生成流程（借鉴智能导入的 training data 结构描述）
                    const systemPrompt = `你是一个训练计划批量操作助手。

## 你的任务
根据用户的自然语言指令，生成 TypeScript 代码来修改训练计划。对于动作 ID，请优先复用动作库；若未命中或用户明确要求“新动作”，必须进入待确认流程（使用 \`pending:\` 临时 ID），禁止把“新动作”硬匹配到相似旧动作。
如果用户表达的是“太重/太轻/做不了/过轻松”等负荷反馈，且当前计划重量主要依赖全局 1RM，请优先通过 \`oneRmAdjustments\` 调整动作级全局 1RM，而不是只把当前计划写死成固定重量。
如果用户明确说“直接写成多少 kg / 把问卷已知重量填进计划 / 改成固定重量 / 改成 8RM / 改成 75%1RM”，优先使用 \`loadAdjustments\`，这样不需要为了小范围负荷调整去重写整份计划。

## 训练计划数据结构

### trainingDays（训练日数组）
每个元素表示一天，按 dayIndex 顺序排列。

\`\`\`typescript
interface TrainingDay {
    type: 'training' | 'rest';   // 训练日 或 休息日
    note?: string;                 // 当天备注
    actionSets?: ActionSet[];     // 当天的动作集合（仅 type===training 时有）
    dayIndex: number;              // 第几天，从 1 开始
}
\`\`\`

### ActionSet（单日内的一个动作项）
\`\`\`typescript
interface ActionSet {
    actionId: string;   // 已有动作使用真实 id；待确认新动作可使用 pending:xxx 临时 id
    itemType?: 'STRENGTH' | 'CARDIO' | 'DIET' | 'HABIT';  // 必须与动作库中该 actionId 的 type 一致，用于前端展示图标和表单
    setName?: string;
    params: {
        action_name?: string;   // 可选，展示用名称
        '组数'?: number;        // 组数（STRENGTH 常用）；计划中的规范键，不要写 sets
        '次数'?: number;        // 次数（STRENGTH 常用）；不要写 reps
        '持续时间'?: number;    // 计时类动作每组秒数
        '休息时间'?: number;    // 组间休息秒；不要写 rest_seconds
        weight?: number;       // 旧字段兼容：固定重量 kg
        load?: number;         // 当前计划显示/使用的重量 kg
        loadUnit?: 'kg' | 'lbs';
        note?: string;
        intensityConfig?: IntensityConfig; // 强度配置（RM、百分比、固定重量、推荐负重）
        '强度'?: number;        // 旧格式兼容：RM 值（如 5 表示 5RM）
        // 有氧/饮食/习惯类动作可能还有 customData，见下
    };
}

interface IntensityConfig {
    relativeIntensity?: {
        type: 'rm' | 'percentage';  // rm=RM次数, percentage=1RM百分比
        value: number;              // RM时为1-30(如5表示5RM), 百分比时为1-100(如80表示80%)
    };
    fixedWeight?: {
        value: number;
        unit: 'kg' | 'lbs';
    };
    recommendedLoad?: {
        value: number;  // 推荐重量数值
        unit: 'kg' | 'lbs';
    };
}
\`\`\`

### 修改 RM / 强度 的规则
- 用户说"改成 8RM"时，设置 \`params.intensityConfig = { relativeIntensity: { type: 'rm', value: 8 } }\`，同时设置 \`params['强度'] = 8\`（旧格式兼容）
- 用户说"改成 80%"时，设置 \`params.intensityConfig = { relativeIntensity: { type: 'percentage', value: 80 } }\`
- 用户说"直接写成 60kg / 固定 60kg"时，设置 \`params.load = 60\`、\`params.weight = 60\`，并设置 \`params.intensityConfig = { fixedWeight: { value: 60, unit: 'kg' } }\`
- 如果已有 \`recommendedLoad\`，修改 RM 时保留它不要删除
- 修改 RM 时不需要修改 \`weight\` 字段（weight 是固定重量模式的值）

### 替换/添加动作时 itemType 必须同步
**关键**：当你替换或添加动作时，必须同时设置 \`actionSet.itemType\` 为动作库中该 actionId 对应的 type。
- 例如将引体替换为跑步：\`actionSet.actionId = runningId\` 的同时，必须 \`actionSet.itemType = 'CARDIO'\`（因为跑步在动作库中是 CARDIO 类型）
- 可用 \`findActionById(actionId)?.type\` 获取类型，取值为 'STRENGTH'|'CARDIO'|'DIET'|'HABIT'，若无则用 'STRENGTH'

### 动作类型与 params 规则（与智能导入一致）
- **STRENGTH（力量）**：使用 '组数'、'次数'（或 '持续时间'）、'休息时间'、load；可配 intensityConfig（如 RM、百分比）。读写都用中文键，例如 \`set.params['组数'] = 5\`
- **CARDIO（有氧）**：不写组数/次数/重量，用 params 中的 '距离'、'配速'、'持续时间' 或 note 表达距离/时长/配速等
- **DIET / HABIT**：以 '食物清单'、'热量'、'目标数值' 等中文键或 note 为主
- 力量动作换成有氧/饮食/习惯动作时，新建 params，不要沿用力量参数

### 重要约束
1. **新动作不能误配**：若找不到“规范化后全等”的已有动作，或用户明确说“新增/新动作/不存在动作库”，必须使用 \`ensureActionIdByName("动作名")\` 获取 actionId（未命中时会返回 \`pending:xxx\`），并在 params 中写 \`action_name\` 原名。
2. **禁止宽松相似匹配**：不要用“包含关系”把新动作硬匹配到旧动作（例如“单手双力臂”不能自动映射成“单手交替悬挂”）。
3. **替换/添加动作时必须设置 itemType**：修改 \`actionSet.actionId\` 时，必须同时设置 \`actionSet.itemType = findActionById(newActionId)?.type || 'STRENGTH'\`。若 \`newActionId\` 是 \`pending:\` 前缀，则按用户语义显式设置正确类型。
4. 直接修改 \`trainingDays\` 数组即可，不要 return。
5. 代码在沙箱中执行，禁止 \`require\`、\`fetch\`、异步、全局变量等。
6. 处理边界情况：先判断 \`day.actionSets\` 存在再遍历，避免空引用。
7. \`oneRmAdjustments\` 的 \`deltaKg\` 必须是 2.5kg 的整数倍。轻微偏差默认 ±2.5kg，明显偏差可用 ±5kg、±7.5kg、±10kg。
8. \`loadAdjustments\` 可用于结构化负荷修改：
   - \`mode="fixed"\`：直接固定重量，使用 \`targetKg\` 或 \`deltaKg\`；
   - \`mode="rm"\`：使用 \`targetValue\` 指定新的 RM；
   - \`mode="percentage"\`：使用 \`targetValue\` 指定新的 %1RM；
   - 如果只是这类负荷调整，\`code\` 可以为空字符串或 no-op。

## 可用的辅助函数
- \`findActionByName(name: string)\`: 仅“规范化后全等”匹配，匹配失败返回 null
- \`findActionById(id: string)\`: 通过 id 查找动作，返回 \`{ id, name, type }\`
- \`ensureActionIdByName(name: string)\`: 优先返回已存在动作 id；若未命中返回 \`pending:xxx\`（后续会触发人工确认创建）

## 当前可用的动作列表（仅允许使用以下 id）
${actionLibraryForSystemPrompt}

## 业务上下文（必须参考）
${contextPrompt}

## trainingDays 当前内容示例
${includePlanBody ? JSON.stringify(trainingDays.slice(0, 2), null, 2) : '（已关闭：计划/模板本体上下文）'}

## 用户当前修改指令
${effectiveModificationInstruction}

## 请生成 TypeScript 代码
返回 JSON：
{
    "actionPlan": "一句用户友好的执行计划说明（中文）",
    "code": "<仅修改 trainingDays 的 TypeScript 代码，不要包含注释外的任何说明；如果只需要调整全局1RM且 trainingDays 不变，可返回空字符串或 no-op 代码>",
    "oneRmAdjustments": [
        {
            "actionName": "需要调整 1RM 的动作名",
            "deltaKg": -2.5,
            "reason": "为什么要这样调整"
        }
    ],
    "loadAdjustments": [
        {
            "actionName": "需要直接改负荷的动作名",
            "dayIndex": 3,
            "setIndex": 1,
            "mode": "fixed",
            "targetKg": 60,
            "reason": "问卷已知当前工作重量"
        }
    ]
}`;

                    // 4. 调用 AI 并执行代码（支持重试）
                    const maxRetries = 3;
                    let retryCount = 0;
                    let executionResult: any = null;
                    let lastError: string = '';
                    
                    const messages: Array<{ role: "system" | "user" | "assistant", content: string }> = [
                        ...buildPromptMessages(systemPrompt),
                    ];

                    while (retryCount < maxRetries) {
                        try {
                            // 生成或重新生成代码
                            if (retryCount === 0) {
                                sendMessage({ type: 'progress', message: '正在生成操作方案' });
                            } else {
                                // 用户友好的消息，开发模式下显示重试次数
                                const retryMessage = isDevelopment 
                                    ? `正在微调执行序列（第 ${retryCount + 1}/${maxRetries} 次尝试）`
                                    : '正在微调执行序列';
                                sendMessage({ type: 'progress', message: retryMessage });
                            }

                            const aiStartTime = Date.now();
                            const completion = await createChatCompletionWithRetry(openai, {
                                model: llmModel,
                                messages: messages,
                                response_format: { type: "json_object" },
                                temperature: 0.2,
                                max_tokens: 12000
                            }, signal);
                            const aiDuration = Date.now() - aiStartTime;

                            const responseContent = completion.choices[0]?.message?.content;
                            if (!responseContent) {
                                throw new Error('AI 未返回有效响应');
                            }

                            const aiResponse = JSON.parse(responseContent) as {
                                actionPlan: string;
                                code?: string;
                                oneRmAdjustments?: OneRmAdjustmentDraft[];
                                loadAdjustments?: LoadAdjustmentDraft[];
                            };

                            // 开发模式：打印 AI 生成的 TypeScript 代码，便于 debug
                            if (isDevelopment && aiResponse?.code) {
                                console.log('[batch-operation] AI 生成的 TypeScript 代码:\n', aiResponse.code);
                            }

                            // 第一次生成时发送执行计划
                            if (retryCount === 0) {
                                sendMessage({
                                    type: 'action_plan',
                                    plan: aiResponse.actionPlan || '准备执行批量操作'
                                });
                            }

                            // 如果是开发模式，发送统计信息
                            if (isDevelopment && completion.usage) {
                                sendMessage({
                                    type: 'stats',
                                    tokenUsage: {
                                        prompt: completion.usage.prompt_tokens,
                                        completion: completion.usage.completion_tokens,
                                        total: completion.usage.total_tokens
                                    },
                                    duration: aiDuration
                                });
                            }

                            // 执行代码
                            sendMessage({ type: 'progress', message: '正在执行操作...' });

                            executionResult = await executeCodeInVM(
                                aiResponse.code || '',
                                trainingDays,
                                actions,
                            );

                            if (executionResult.success) {
                                const loadAdjustmentResult = applyLoadAdjustments({
                                    drafts: Array.isArray(aiResponse.loadAdjustments) ? aiResponse.loadAdjustments : [],
                                    trainingDays: executionResult.result || [],
                                    actions: actions.map((action: any) => ({
                                        id: action.id,
                                        name: action.name,
                                    })),
                                });
                                executionResult.result = loadAdjustmentResult.updatedTrainingDays;
                                const oneRmDrafts = Array.isArray(aiResponse.oneRmAdjustments) ? aiResponse.oneRmAdjustments : [];
                                const oneRmAdjustments = await resolveOneRmPreviewAdjustments({
                                    drafts: oneRmDrafts,
                                    userId,
                                    targetActionType,
                                    contextOptions,
                                    actions,
                                });
                                // 按规范化后的语义比较：只把 sets 抄成 组数 这类改写不算修改。
                                const semanticChanges = analyzeModifications(
                                    normalizeTrainingDaysForEditor(trainingDays, actions, trainingDays),
                                    normalizeTrainingDaysForEditor(executionResult.result || [], actions, trainingDays),
                                    actions,
                                );
                                // 只提了 1RM 调整却没落成时不再重试：重试会逼模型改计划来过检查，
                                // 交给收尾步骤向教练说明哪条没生效。
                                if (
                                    semanticChanges.length === 0 &&
                                    oneRmAdjustments.adjustments.length === 0 &&
                                    oneRmDrafts.length === 0
                                ) {
                                    lastError = deterministicResult.matched && deterministicResult.reason
                                        ? `${deterministicResult.reason}\n另外，上一次生成的代码执行成功但没有对 trainingDays 产生任何修改。请严格按用户指令定位并实际改写数组。`
                                        : '上一次生成的代码执行成功，但没有对 trainingDays 产生任何修改。请严格按用户指令定位目标训练日/动作，并实际改写数组。';
                                    retryCount++;

                                    if (retryCount < maxRetries) {
                                        messages.push(
                                            { role: "assistant", content: responseContent },
                                            {
                                                role: "user",
                                                content: `代码执行结果没有任何实际修改。\n\n补充要求：\n${lastError}\n\n请重新生成真正会修改 trainingDays 的代码。注意：\n1. 必须让目标训练日/动作发生实际变化\n2. 不要使用 return 语句，直接修改 trainingDays 数组\n3. 如果替换动作不在动作库，请使用 pending: 临时 actionId`
                                            }
                                        );
                                        continue;
                                    }

                                    throw new Error('操作执行失败：已多次尝试，但生成的代码始终没有对训练计划产生实际修改。请尝试更明确描述范围、动作名和目标参数。');
                                }
                                // 执行成功，跳出重试循环
                                executionResult.oneRmAdjustments = oneRmAdjustments;
                                executionResult.oneRmDrafts = oneRmDrafts;
                                executionResult.loadAdjustmentCount = loadAdjustmentResult.adjustments.length;
                                break;
                            } else {
                                // 执行失败，准备重试
                                lastError = executionResult.error || '代码执行失败';
                                retryCount++;

                                if (retryCount < maxRetries) {
                                    // 将错误信息加入上下文
                                    messages.push(
                                        { role: "assistant", content: responseContent },
                                        { 
                                            role: "user", 
                                            content: `代码执行失败，错误信息：${lastError}\n\n请修复代码中的错误，重新生成正确的代码。注意：\n1. 不要使用return语句，直接修改trainingDays数组\n2. 确保所有语法正确\n3. 处理可能的边界情况`
                                        }
                                    );
                                } else {
                                    // 达到最大重试次数
                                    throw new Error('操作执行失败，已尝试多次修正但仍存在问题。请尝试更清晰地描述你的需求，或者手动编辑计划。');
                                }
                            }
                        } catch (error: any) {
                            signal.throwIfAborted();
                            if (retryCount >= maxRetries - 1) {
                                throw error;
                            }
                            lastError = error.message;
                            retryCount++;
                        }
                    }

                    if (!executionResult || !executionResult.success) {
                        throw new Error('操作执行失败，已尝试多次修正但仍存在问题。请尝试更清晰地描述你的需求，或者手动编辑计划。');
                    }

                    // 6. 分析差异并发送预览结果(不保存到数据库)
                    await finishModificationTurn({
                        updatedTrainingDays: executionResult.result || [],
                        oneRmDrafts: executionResult.oneRmDrafts,
                        resolvedOneRm: executionResult.oneRmAdjustments,
                        resultMessage: (count, oneRmCount) =>
                            `分析完成，共发现 ${count} 处修改${executionResult.loadAdjustmentCount ? `，并结构化应用 ${executionResult.loadAdjustmentCount} 条负荷调整` : ''}${oneRmCount > 0 ? `，并调整 ${oneRmCount} 个动作的全局1RM` : ''}`,
                        newActionsHint: '请先在动作库中创建这些动作后再应用，或确认是否仍要应用计划。',
                    });

        }, formatBatchOperationError);

    } catch (error: any) {
        console.error('[batch-operation] Request error:', error);
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { status: 500 }
        );
    }
}
