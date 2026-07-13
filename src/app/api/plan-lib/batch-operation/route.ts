import { NextRequest } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import ivm from "isolated-vm";
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
import { getCoachlinkFastLlm, getCoachlinkPlanLlm } from "@/lib/coachlinkLlm";
import { tryApplyDeterministicBatchEdit } from "@/lib/batchOperationDeterministic";
import { formatTemplateToPlanScript, parsePlanScript } from "@/lib/planScript";
import { resolveOneRmAdjustments, type OneRmAdjustmentDraft } from "@/lib/oneRmAdjustments";
import { applyLoadAdjustments, type LoadAdjustmentDraft } from "@/lib/loadAdjustments";

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
    if (isRetryableLlmConnectionError(error)) {
        return '万界方舟连接在返回结果前被中断，系统已自动重试 1 次仍未成功。请稍后重试；若 deepseek-v4-pro 持续超时，可在 Apollo 临时将 WANJIE_ARK_PLAN_MODEL 设为 deepseek-v4-flash。';
    }
    return error?.message || '操作失败';
}

async function createChatCompletionWithRetry(client: any, body: any) {
    try {
        return await client.chat.completions.create(body);
    } catch (error) {
        if (!isRetryableLlmConnectionError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 800));
        return client.chat.completions.create(body);
    }
}

async function createJsonChatCompletionWithRetry(client: any, body: any) {
    const completion = await createChatCompletionWithRetry(client, body);
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
    return createChatCompletionWithRetry(client, body);
}

function normalizeActionNameKey(name?: string | null) {
    return String(name || "")
        .toLowerCase()
        .replace(/[\s\-_()（）【】\[\]·,，.。]/g, "")
        .trim();
}

/**
 * 在隔离的虚拟机中安全执行 TypeScript 代码
 */
async function executeCodeInVM(
    code: string,
    trainingDays: any[],
    actions: Array<{ id: string; name: string }>,
    timeout = 10000,
    memoryLimit = 128
): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
        // 创建隔离的虚拟机实例
        const isolate = new ivm.Isolate({ memoryLimit });
        const context = await isolate.createContext();

        // 注入数据到虚拟机上下文
        const jail = context.global;
        await jail.set('global', jail.derefInto());

        // 将 trainingDays 和 actions 注入到虚拟机
        await jail.set(
            'trainingDaysJSON',
            new ivm.ExternalCopy(JSON.stringify(trainingDays)).copyInto()
        );
        await jail.set(
            'actionsJSON',
            new ivm.ExternalCopy(JSON.stringify(actions)).copyInto()
        );

        // 准备执行的代码
        const scriptCode = `
            // 解析输入数据
            const trainingDays = JSON.parse(trainingDaysJSON);
            const actions = JSON.parse(actionsJSON);
            
            // 辅助函数
            const normalizeActionName = (name) => String(name || '')
                .toLowerCase()
                .replace(/[\\s\\-_()（）【】\\[\\]·,，.。]/g, '');

            const findActionByName = (name) => {
                const target = normalizeActionName(name);
                if (!target) return null;
                // 严格匹配：仅允许“规范化后全等”
                return actions.find(a => normalizeActionName(a.name) === target) || null;
            };
            
            const findActionById = (id) => {
                return actions.find(a => a.id === id);
            };

            // 优先命中动作库；未命中则返回待确认的临时 actionId（后续走人工确认创建）
            const ensureActionIdByName = (name) => {
                const matched = findActionByName(name);
                if (matched?.id) return matched.id;
                const normalized = normalizeActionName(name);
                return normalized ? ('pending:' + normalized.slice(0, 48)) : 'pending:unnamed';
            };
            
            // 用户代码
            ${code}
            
            // 返回结果
            JSON.stringify(trainingDays);
        `;

        // 编译并执行代码
        const script = await isolate.compileScript(scriptCode);
        const result = await script.run(context, { timeout });

        // 解析结果
        const updatedTrainingDays = JSON.parse(result);

        return {
            success: true,
            result: updatedTrainingDays
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || '代码执行失败'
        };
    }
}

/**
 * 分析训练计划的修改差异
 */
function analyzeModifications(
    original: any[],
    updated: any[],
    actions: Array<{ id: string; name: string }>
): ModificationDiff[] {
    const modifications: ModificationDiff[] = [];
    const actionMap = new Map(actions.map(a => [a.id, a.name]));

    for (let i = 0; i < Math.max(original.length, updated.length); i++) {
        const origDay = original[i];
        const updDay = updated[i];

        // 检查训练日是否被删除
        if (origDay && !updDay) {
            modifications.push({
                dayIndex: origDay.dayIndex || i + 1,
                actionName: '整个训练日',
                field: '删除',
                oldValue: origDay.type === 'training' ? '训练日' : '休息日',
                newValue: '已删除'
            });
            continue;
        }

        // 检查训练日是否被添加
        if (!origDay && updDay) {
            modifications.push({
                dayIndex: updDay.dayIndex || i + 1,
                actionName: '整个训练日',
                field: '添加',
                oldValue: '无',
                newValue: updDay.type === 'training' ? '训练日' : '休息日'
            });
            continue;
        }

        if (!origDay || !updDay) continue;

        const dayIndex = updDay.dayIndex || i + 1;

        // 检查训练日类型变化
        if (origDay.type !== updDay.type) {
            modifications.push({
                dayIndex,
                actionName: '训练日类型',
                field: 'type',
                oldValue: origDay.type === 'training' ? '训练日' : '休息日',
                newValue: updDay.type === 'training' ? '训练日' : '休息日'
            });
        }

        // 检查备注变化
        if (origDay.note !== updDay.note) {
            modifications.push({
                dayIndex,
                actionName: '备注',
                field: 'note',
                oldValue: origDay.note || '无',
                newValue: updDay.note || '无'
            });
        }

        // 检查动作集变化
        const origSets = origDay.actionSets || [];
        const updSets = updDay.actionSets || [];

        for (let j = 0; j < Math.max(origSets.length, updSets.length); j++) {
            const origSet = origSets[j];
            const updSet = updSets[j];

            if (!origSet && updSet) {
                // 新增动作
                const actionName = actionMap.get(updSet.actionId) || updSet.params?.action_name || '未知动作';
                modifications.push({
                    dayIndex,
                    actionName,
                    field: '添加动作',
                    oldValue: '无',
                    newValue: `${actionName} (${updSet.params?.sets || 0}组 × ${updSet.params?.reps || 0}次)`
                });
            } else if (origSet && !updSet) {
                // 删除动作
                const actionName = actionMap.get(origSet.actionId) || origSet.params?.action_name || '未知动作';
                modifications.push({
                    dayIndex,
                    actionName,
                    field: '删除动作',
                    oldValue: `${actionName} (${origSet.params?.sets || 0}组 × ${origSet.params?.reps || 0}次)`,
                    newValue: '已删除'
                });
            } else if (origSet && updSet) {
                const actionName = actionMap.get(updSet.actionId) || updSet.params?.action_name || '未知动作';

                // 检查动作ID变化(替换)
                if (origSet.actionId !== updSet.actionId) {
                    const oldActionName = actionMap.get(origSet.actionId) || origSet.params?.action_name || '未知动作';
                    const newActionName = actionMap.get(updSet.actionId) || updSet.params?.action_name || '未知动作';
                    modifications.push({
                        dayIndex,
                        actionName: oldActionName,
                        field: '替换动作',
                        oldValue: oldActionName,
                        newValue: newActionName
                    });
                }

                // 检查参数变化
                const origParams = origSet.params || {};
                const updParams = updSet.params || {};

                if (origParams.sets !== updParams.sets) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '组数',
                        oldValue: origParams.sets || 0,
                        newValue: updParams.sets || 0
                    });
                }

                if (origParams.reps !== updParams.reps) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '次数',
                        oldValue: origParams.reps || 0,
                        newValue: updParams.reps || 0
                    });
                }

                const origFixedLoad = firstDefinedNumber(
                    origParams.load,
                    origParams.weight,
                    origParams.intensityConfig?.fixedWeight?.value,
                );
                const updFixedLoad = firstDefinedNumber(
                    updParams.load,
                    updParams.weight,
                    updParams.intensityConfig?.fixedWeight?.value,
                );
                if (origFixedLoad !== updFixedLoad && (origFixedLoad != null || updFixedLoad != null)) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '重量',
                        oldValue: `${origFixedLoad || 0}kg`,
                        newValue: `${updFixedLoad || 0}kg`
                    });
                }

                if (origParams.rest_seconds !== updParams.rest_seconds) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '休息时间',
                        oldValue: `${origParams.rest_seconds || 0}秒`,
                        newValue: `${updParams.rest_seconds || 0}秒`
                    });
                }

                const origIC = origParams.intensityConfig;
                const updIC = updParams.intensityConfig;
                const origRI = origIC?.relativeIntensity;
                const updRI = updIC?.relativeIntensity;

                if (origRI?.type !== updRI?.type || origRI?.value !== updRI?.value) {
                    const fmtIntensity = (ri?: { type?: string; value?: number }) => {
                        if (!ri) return '无';
                        return ri.type === 'percentage' ? `${ri.value}%` : `${ri.value}RM`;
                    };
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '强度',
                        oldValue: fmtIntensity(origRI),
                        newValue: fmtIntensity(updRI)
                    });
                } else {
                    const origLegacyRM = origParams['强度'];
                    const updLegacyRM = updParams['强度'];
                    if (origLegacyRM !== updLegacyRM && (origLegacyRM != null || updLegacyRM != null)) {
                        modifications.push({
                            dayIndex,
                            actionName,
                            field: '强度',
                            oldValue: origLegacyRM != null ? `${origLegacyRM}RM` : '无',
                            newValue: updLegacyRM != null ? `${updLegacyRM}RM` : '无'
                        });
                    }
                }

                const origRecLoad = origIC?.recommendedLoad;
                const updRecLoad = updIC?.recommendedLoad;
                if (origRecLoad?.value !== updRecLoad?.value || origRecLoad?.unit !== updRecLoad?.unit) {
                    if (origRecLoad != null || updRecLoad != null) {
                        modifications.push({
                            dayIndex,
                            actionName,
                            field: '推荐负重',
                            oldValue: origRecLoad ? `${origRecLoad.value}${origRecLoad.unit}` : '无',
                            newValue: updRecLoad ? `${updRecLoad.value}${updRecLoad.unit}` : '无'
                        });
                    }
                }

                if (origParams.note !== updParams.note && (origParams.note != null || updParams.note != null)) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '备注',
                        oldValue: origParams.note || '无',
                        newValue: updParams.note || '无'
                    });
                }
            }
        }
    }

    return modifications;
}

const ITEM_TYPES: ItemType[] = ["STRENGTH", "CARDIO", "DIET", "HABIT"];
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

function normalizeItemType(input?: unknown): ItemType {
    const raw = String(input ?? "").toUpperCase();
    if (ITEM_TYPES.includes(raw as ItemType)) return raw as ItemType;
    return "STRENGTH";
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

function firstDefinedNumber(...values: any[]): number | null {
    for (const value of values) {
        if (value === null || value === undefined || value === "") continue;
        const n = Number(value);
        if (!Number.isNaN(n)) return n;
    }
    return null;
}

function normalizeStrengthParamsForEditor(params: any): any {
    const src = params || {};
    const next = { ...src };

    const sets = firstDefinedNumber(src["组数"], src.sets);
    const reps = firstDefinedNumber(src["次数"], src.reps);
    const duration = firstDefinedNumber(src["持续时间"], src.durationSeconds, src.duration_seconds);
    const restSeconds = firstDefinedNumber(src["休息时间"], src.rest_seconds, src.restSeconds);
    const load = firstDefinedNumber(
        src.load,
        src.weight,
        src.fixedWeight,
        src.intensityConfig?.fixedWeight?.value,
        src.intensityConfig?.fixedWeight,
    );

    if (sets !== null) next["组数"] = sets;
    if (reps !== null) next["次数"] = reps;
    if (duration !== null) next["持续时间"] = duration;
    if (restSeconds !== null) next["休息时间"] = restSeconds;
    if (load !== null) next.load = load;
    if (src.note !== undefined) next.note = src.note;
    if (src.action_name !== undefined) next.action_name = src.action_name;

    return next;
}

function normalizeActionSetForEditor(actionSet: any, actionTypeMap: Map<string, ItemType>): any {
    if (!actionSet || typeof actionSet !== "object") return actionSet;
    if (actionSet.type === "one-filter" && Array.isArray(actionSet.actions)) {
        return {
            ...actionSet,
            actions: actionSet.actions.map((inner: any) => normalizeActionSetForEditor(inner, actionTypeMap)),
        };
    }

    const actionId = String(actionSet.actionId || "");
    const inferredType = normalizeItemType(actionSet.itemType || actionTypeMap.get(actionId) || "STRENGTH");
    const next = {
        ...actionSet,
        itemType: inferredType,
    };

    if (inferredType === "STRENGTH") {
        next.params = normalizeStrengthParamsForEditor(actionSet.params);
    }
    return next;
}

function normalizeTrainingDaysForEditor(trainingDays: any[], actions: any[]): any[] {
    const actionTypeMap = new Map<string, ItemType>();
    for (const action of actions || []) {
        actionTypeMap.set(action.id, normalizeItemType(action.type));
    }
    return (trainingDays || []).map((day) => ({
        ...day,
        actionSets: (day?.actionSets || []).map((set: any) =>
            normalizeActionSetForEditor(set, actionTypeMap),
        ),
    }));
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

    const subscriptionId = String(contextOptions?.subscriptionId || "").trim();
    if (subscriptionId) {
        const { data: subscription } = await supabase
            .from("coach_subscriptions")
            .select("student_id, coach_id, coaches(user_id)")
            .eq("id", subscriptionId)
            .maybeSingle();
        const coachInfo = subscription?.coaches as any;
        const isOwner = coachInfo?.user_id === userId || String(subscription?.coach_id || "") === userId;
        return isOwner ? String(subscription?.student_id || "") || null : null;
    }

    const hintedSubjectUserId = String(contextOptions?.subjectUserId || "").trim();
    if (!hintedSubjectUserId) return null;

    const { data: ownedRows } = await supabase
        .from("coach_subscriptions")
        .select("student_id, coach_id, coaches(user_id)")
        .eq("student_id", hintedSubjectUserId)
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
}): Promise<OneRmAdjustmentPreview[]> {
    const drafts = params.drafts || [];
    if (drafts.length === 0) return [];

    const subjectUserId = await resolveSubjectUserIdForOneRmAdjustments({
        userId: params.userId,
        targetActionType: params.targetActionType,
        contextOptions: params.contextOptions,
    });
    if (!subjectUserId) return [];

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

    return resolveOneRmAdjustments({
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
}

async function runPlanScriptEdit(params: {
    openai: ReturnType<typeof getCoachlinkPlanLlm>["client"];
    llmModel: string;
    trainingDays: any[];
    actions: any[];
    effectiveInstruction: string;
    contextPrompt: string;
    deterministicReason?: string;
    sendMessage: (message: SSEMessage) => void;
}): Promise<PlanScriptEditResult> {
    const {
        openai,
        llmModel,
        trainingDays,
        actions,
        effectiveInstruction,
        contextPrompt,
        deterministicReason,
        sendMessage,
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
    const maxRetries = 2;
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        {
            role: "system",
            content: "你是 coachlink 的训练计划脚本编辑器。你只输出 JSON，不输出额外说明。",
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
- 如果用户表达的是“太重/太轻/做不了/过轻松”等负荷反馈，且当前计划的重量本质依赖全局 1RM，请优先输出 \`oneRmAdjustments\` 来调整动作级全局 1RM，而不是把计划写死成固定重量。
- 如果用户明确要“直接写成 60kg / 按问卷已知重量回填 / 改成固定重量 / 改成 8RM / 改成 75%1RM”，优先输出 \`loadAdjustments\`，不要为了这类小改动重写整份脚本。
- \`oneRmAdjustments\` 里的 \`deltaKg\` 必须是 2.5kg 的整数倍。轻微偏差默认用 ±2.5kg，明显偏差可用 ±5kg、±7.5kg、±10kg。
- \`loadAdjustments\` 里：
  - \`mode="fixed"\` 表示直接把计划写死成固定重量，不再跟随 1RM 自动重算；
  - \`mode="rm"\` 表示把该动作改成指定 RM；
  - \`mode="percentage"\` 表示把该动作改成指定 %1RM；
  - \`targetKg\` / \`deltaKg\` 仅用于 \`mode="fixed"\`，并且必须是 2.5kg 的整数倍；
  - \`targetValue\` 仅用于 \`mode="rm"\` 或 \`mode="percentage"\`。
- 如果只是调整全局 1RM 而不需要改计划脚本结构，\`script\` 可以保持与当前计划脚本一致。
- 如果只是做 \`loadAdjustments\` 或 \`oneRmAdjustments\`，\`script\` 也可以保持与当前计划脚本一致。

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

请严格返回 JSON：
{
  "actionPlan": "一句中文说明你做了什么",
  "script": "完整修改后的计划脚本",
  "cannotApplyReason": "如果无法修改，写明原因；可以修改时为空字符串",
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
}`,
        },
    ];

    let lastError = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    const startedAt = Date.now();

    for (let retry = 0; retry < maxRetries; retry++) {
        sendMessage({
            type: "progress",
            message: retry === 0 ? "正在用计划脚本生成修改方案" : "正在微调计划脚本",
        });

        const completion = await createChatCompletionWithRetry(openai, {
            model: llmModel,
            messages,
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 6000,
        });

        promptTokens += completion.usage?.prompt_tokens || 0;
        completionTokens += completion.usage?.completion_tokens || 0;
        totalTokens += completion.usage?.total_tokens || 0;

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
            lastError = "AI 未返回有效脚本";
        } else {
            try {
                const response = JSON.parse(responseContent) as {
                    actionPlan?: string;
                    script?: string;
                    cannotApplyReason?: string;
                    oneRmAdjustments?: OneRmAdjustmentDraft[];
                    loadAdjustments?: LoadAdjustmentDraft[];
                };

                if (response.cannotApplyReason?.trim()) {
                    return {
                        success: false,
                        error: response.cannotApplyReason.trim(),
                        promptTokens,
                        completionTokens,
                        totalTokens,
                        duration: Date.now() - startedAt,
                    };
                }

                const oneRmAdjustments = Array.isArray(response.oneRmAdjustments)
                    ? response.oneRmAdjustments
                    : [];
                const loadAdjustments = Array.isArray(response.loadAdjustments)
                    ? response.loadAdjustments
                    : [];
                const nextScript = response.script?.trim() || (
                    oneRmAdjustments.length > 0 || loadAdjustments.length > 0
                        ? currentScript
                        : ""
                );

                if (!nextScript.trim()) {
                    throw new Error("AI 返回缺少 script 字段");
                }

                if (
                    normalizePlanScriptText(nextScript) === normalizePlanScriptText(currentScript) &&
                    oneRmAdjustments.length === 0 &&
                    loadAdjustments.length === 0
                ) {
                    throw new Error("AI 返回的计划脚本与原脚本相同，没有实际修改");
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

                const loadAdjustmentResult = applyLoadAdjustments({
                    drafts: loadAdjustments,
                    trainingDays: parsed.days,
                    actions: actions.map((action: any) => ({
                        id: action.id,
                        name: action.name,
                    })),
                });

                return {
                    success: true,
                    actionPlan: response.actionPlan || "已根据计划脚本完成修改",
                    updatedTrainingDays: loadAdjustmentResult.updatedTrainingDays,
                    oneRmAdjustments,
                    loadAdjustments,
                    appliedLoadAdjustments: loadAdjustmentResult.adjustments.length,
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
                        content: `上一次返回的脚本无法编译或没有实际修改：${lastError}\n请重新返回完整可编译脚本，并且只修改用户要求的部分。`,
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
            targetActionType = "coach",
            contextOptions,
            previewInputOnly = false,
            editEngine = "code",
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

        // 合并多轮对话为模型可见的完整指令（首轮 + 助手追问 + 用户补充）
        const effectiveInstruction =
            conversationHistory.length === 0
                ? instruction
                : [
                    `【用户首轮指令】\n${instruction}`,
                    ...conversationHistory.map(
                        (t) => `【${t.role === 'assistant' ? '助手追问' : '用户补充'}】\n${t.content}`
                    ),
                ].join('\n\n');

        // 创建 SSE 响应
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                // 辅助函数：发送 SSE 消息
                const sendMessage = (message: SSEMessage) => {
                    const data = `data: ${JSON.stringify(message)}\n\n`;
                    controller.enqueue(encoder.encode(data));
                };

                try {
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
                    });
                    const baselineContextBuild = previewInputOnly
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

## 用户指令（含多轮对话时此处为完整上下文）
${effectiveInstruction}

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

## 用户问题（含多轮对话时此处为完整上下文）
${effectiveInstruction}

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

## 用户指令（含多轮对话时此处为完整上下文，请结合用户补充判断是否已完整）
${effectiveInstruction}`;

                        const previewSystemPrompt = `你是一个训练计划批量操作助手。

## 你的任务
根据用户的自然语言指令，生成 TypeScript 代码来修改训练计划。

## 当前可用的动作列表（仅允许使用以下 id）
${actionLibraryForSystemPrompt}

## 业务上下文（必须参考）
${contextPrompt}

## trainingDays 当前内容示例
${includePlanBody ? JSON.stringify(trainingDays.slice(0, 2), null, 2) : '（已关闭：计划/模板本体上下文）'}

## 用户指令（含多轮对话时此处为完整上下文，请按用户最终意图生成代码）
${effectiveInstruction}`;

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

## 用户指令（含多轮对话时此处为完整上下文）
${effectiveInstruction}

请返回 JSON 格式:
{
    "intent": "query" 或 "modify",
    "reason": "简短说明判断依据"
}`;

                    const { client: openai, model: llmModel, provider: llmProvider } = getCoachlinkPlanLlm();
                    const { client: fastOpenai, model: fastLlmModel } = getCoachlinkFastLlm();
                    if (isDevelopment) {
                        console.log(`[batch-operation] LLM: ${llmProvider} / ${llmModel}`);
                    }
                    const intentCompletion = await createJsonChatCompletionWithRetry(fastOpenai, {
                        model: fastLlmModel,
                        messages: buildPromptMessages(intentPrompt),
                        response_format: { type: "json_object" },
                        temperature: 0.1,
                        max_tokens: 2000
                    });

                    const intentContent = intentCompletion.choices[0]?.message?.content;
                    const intentResult = intentContent ? JSON.parse(intentContent) : { intent: 'modify' };
                    const userIntent = intentResult.intent as 'query' | 'modify';

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

## 用户问题（含多轮对话时此处为完整上下文）
${effectiveInstruction}

请用中文回答，格式要清晰易读。如果涉及统计，请给出具体数字。可以使用 markdown 格式（如列表、加粗等）来增强可读性。`;

                        const queryCompletion = await createChatCompletionWithRetry(openai, {
                            model: llmModel,
                            messages: buildPromptMessages(queryPrompt),
                            temperature: 0.3,
                            max_tokens: 6000
                        });

                        const queryAnswer = queryCompletion.choices[0]?.message?.content || '无法分析该问题';
                        const totalDuration = Date.now() - startTime;

                        // 发送统计信息（开发模式）
                        if (isDevelopment) {
                            const totalTokens = (intentCompletion.usage?.total_tokens || 0) + (queryCompletion.usage?.total_tokens || 0);
                            sendMessage({
                                type: 'stats',
                                tokenUsage: {
                                    prompt: (intentCompletion.usage?.prompt_tokens || 0) + (queryCompletion.usage?.prompt_tokens || 0),
                                    completion: (intentCompletion.usage?.completion_tokens || 0) + (queryCompletion.usage?.completion_tokens || 0),
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

## 用户指令（含多轮对话时此处为完整上下文，请结合用户补充判断是否已完整）
${effectiveInstruction}

请严格返回 JSON（不要其他内容）:
{
    "complete": true 或 false,
    "clarificationQuestion": "若 complete 为 false，此处写一句简短的中文追问，例如：请说明要改成哪种具体的有氧运动（如跑步、跳绳、骑行等）？",
    "suggestions": ["若 complete 为 false，此处返回 3～6 个具体推荐选项的字符串数组，与追问内容对应。例如有氧类可填 [\"跑步\", \"跳绳\", \"骑行\", \"游泳\", \"划船\"]，力量类可填动作库中的具体动作名。用户可点击直接选用。"]
}`;
                    const clarificationCompletion = await createJsonChatCompletionWithRetry(fastOpenai, {
                        model: fastLlmModel,
                        messages: buildPromptMessages(clarificationPrompt),
                        response_format: { type: "json_object" },
                        temperature: 0.1,
                        max_tokens: 3000
                    });
                    const clarificationContent = clarificationCompletion.choices[0]?.message?.content;
                    let clarificationResult: { complete?: boolean; clarificationQuestion?: string; suggestions?: string[] } = { complete: true };
                    if (clarificationContent) {
                        try {
                            clarificationResult = JSON.parse(clarificationContent);
                        } catch (_) {}
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
                        instruction: effectiveInstruction,
                        trainingDays,
                        actions: actions as Array<{ id: string; name: string; type?: ItemType | string | null }>,
                    });

                    if (deterministicResult.applied) {
                        sendMessage({ type: 'progress', message: '已按明确规则直接应用修改' });
                        sendMessage({
                            type: 'action_plan',
                            plan: deterministicResult.actionPlan || '已根据明确规则应用批量修改',
                        });

                        const modifications = analyzeModifications(
                            originalTrainingDays,
                            deterministicResult.updatedTrainingDays,
                            actions.map(a => ({ id: a.id, name: a.name })),
                        );

                        const knownActionIds = new Set(actions.map((a: any) => a.id));
                        const pendingActions = collectPendingActions(
                            deterministicResult.updatedTrainingDays || [],
                            knownActionIds,
                        );
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
                                message: `修改计划中包含以下不在您动作库中的动作：${namesList}。请先在动作库中创建这些动作后再应用，或确认是否仍要应用计划。`
                            });
                        }

                        const normalizedUpdatedTrainingDays = normalizeTrainingDaysForEditor(
                            deterministicResult.updatedTrainingDays || [],
                            actions,
                        );
                        const totalDuration = Date.now() - startTime;

                        sendMessage({
                            type: 'preview_result',
                            success: true,
                            originalTrainingDays,
                            updatedTrainingDays: normalizedUpdatedTrainingDays,
                            modifications,
                            pendingActions,
                            oneRmAdjustments: [],
                            message: `分析完成，共发现 ${modifications.length} 处修改${isDevelopment ? ` (总耗时 ${totalDuration}ms)` : ''}`,
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
                                openai,
                                llmModel,
                                trainingDays,
                                actions,
                                effectiveInstruction,
                                contextPrompt,
                                deterministicReason: deterministicResult.matched ? deterministicResult.reason : undefined,
                                sendMessage,
                            });

                            if (scriptResult.success && scriptResult.updatedTrainingDays) {
                                sendMessage({
                                    type: "action_plan",
                                    plan: scriptResult.actionPlan || "已根据计划脚本完成修改",
                                });

                                const modifications = analyzeModifications(
                                    originalTrainingDays,
                                    scriptResult.updatedTrainingDays,
                                    actions.map(a => ({ id: a.id, name: a.name })),
                                );
                                const knownActionIds = new Set(actions.map((a: any) => a.id));
                                const pendingActions = collectPendingActions(
                                    scriptResult.updatedTrainingDays || [],
                                    knownActionIds,
                                );
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
                                        message: `修改计划中包含以下不在您动作库中的动作：${namesList}。可以先确认并创建这些动作，再应用计划。`
                                    });
                                }
                                const normalizedUpdatedTrainingDays = normalizeTrainingDaysForEditor(
                                    scriptResult.updatedTrainingDays || [],
                                    actions,
                                );
                                const oneRmAdjustments = await resolveOneRmPreviewAdjustments({
                                    drafts: scriptResult.oneRmAdjustments,
                                    userId,
                                    targetActionType,
                                    contextOptions,
                                    actions,
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

                                sendMessage({
                                    type: "preview_result",
                                    success: true,
                                    originalTrainingDays,
                                    updatedTrainingDays: normalizedUpdatedTrainingDays,
                                    modifications,
                                    pendingActions,
                                    oneRmAdjustments,
                                    message: `脚本编辑完成，共发现 ${modifications.length} 处修改${scriptResult.appliedLoadAdjustments ? `，并结构化应用 ${scriptResult.appliedLoadAdjustments} 条负荷调整` : ""}${oneRmAdjustments.length > 0 ? `，并调整 ${oneRmAdjustments.length} 个动作的全局1RM` : ""}${isDevelopment ? ` (总耗时 ${Date.now() - startTime}ms)` : ""}`,
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
        sets?: number;          // 组数（STRENGTH 常用）
        reps?: number;          // 次数（STRENGTH 常用）
        weight?: number;       // 旧字段兼容：固定重量 kg
        load?: number;         // 当前计划显示/使用的重量 kg
        loadUnit?: 'kg' | 'lbs';
        rest_seconds?: number;  // 组间休息秒
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
- **STRENGTH（力量）**：使用 sets、reps、weight、rest_seconds；可配 intensityConfig（如 RM、百分比）
- **CARDIO（有氧）**：sets/reps/weight 通常为 null，用 params 中的 customData 或 note 表达距离/时长/配速等
- **DIET / HABIT**：同上，以 customData 或 note 为主

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
- \`findActionById(id: string)\`: 通过 id 查找动作
- \`ensureActionIdByName(name: string)\`: 优先返回已存在动作 id；若未命中返回 \`pending:xxx\`（后续会触发人工确认创建）

## 当前可用的动作列表（仅允许使用以下 id）
${actionLibraryForSystemPrompt}

## 业务上下文（必须参考）
${contextPrompt}

## trainingDays 当前内容示例
${includePlanBody ? JSON.stringify(trainingDays.slice(0, 2), null, 2) : '（已关闭：计划/模板本体上下文）'}

## 用户指令（含多轮对话时此处为完整上下文，请按用户最终意图生成代码）
${effectiveInstruction}

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
                            });
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
                                actions.map(a => ({ id: a.id, name: a.name }))
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
                                const originalSnapshot = JSON.stringify(trainingDays);
                                const resultSnapshot = JSON.stringify(executionResult.result);
                                const oneRmAdjustments = await resolveOneRmPreviewAdjustments({
                                    drafts: Array.isArray(aiResponse.oneRmAdjustments) ? aiResponse.oneRmAdjustments : [],
                                    userId,
                                    targetActionType,
                                    contextOptions,
                                    actions,
                                });
                                if (originalSnapshot === resultSnapshot && oneRmAdjustments.length === 0 && loadAdjustmentResult.adjustments.length === 0) {
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

                    // 6. 分析修改差异
                    const modifications = analyzeModifications(
                        originalTrainingDays,
                        executionResult.result,
                        actions.map(a => ({ id: a.id, name: a.name }))
                    );

                    // 6.1 检测修改计划中是否包含不在动作库中的动作
                    const knownActionIds = new Set(actions.map((a: any) => a.id));
                    const pendingActions = collectPendingActions(executionResult.result || [], knownActionIds);
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
                            message: `修改计划中包含以下不在您动作库中的动作：${namesList}。请先在动作库中创建这些动作后再应用，或确认是否仍要应用计划。`
                        });
                    }

                    const normalizedUpdatedTrainingDays = normalizeTrainingDaysForEditor(
                        executionResult.result || [],
                        actions,
                    );

                    const totalDuration = Date.now() - startTime;

                    // 7. 发送预览结果(不保存到数据库)
                    sendMessage({
                        type: 'preview_result',
                        success: true,
                        originalTrainingDays,
                        updatedTrainingDays: normalizedUpdatedTrainingDays,
                        modifications,
                        pendingActions,
                        oneRmAdjustments: executionResult.oneRmAdjustments || [],
                        message: `分析完成，共发现 ${modifications.length} 处修改${executionResult.loadAdjustmentCount ? `，并结构化应用 ${executionResult.loadAdjustmentCount} 条负荷调整` : ''}${(executionResult.oneRmAdjustments || []).length > 0 ? `，并调整 ${(executionResult.oneRmAdjustments || []).length} 个动作的全局1RM` : ''}${isDevelopment ? ` (总耗时 ${totalDuration}ms)` : ''}`
                    });

                } catch (error: any) {
                    console.error('[batch-operation] Error:', error);
                    sendMessage({
                        type: 'error',
                        message: formatBatchOperationError(error)
                    });
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('[batch-operation] Request error:', error);
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { status: 500 }
        );
    }
}
