import { NextRequest } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import OpenAI from "openai";
import ivm from "isolated-vm";
import {
    BatchOperationDto,
    SSEMessage,
    ModificationDiff,
    NewActionDetected,
    PendingActionCandidate,
    BatchOperationContextOptions,
} from "./entity";
import type { ItemType } from "@/types";
import { sanitizeActionName } from "@/lib/planImportText";

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV === 'development';

// 初始化 OpenAI 客户端 (使用 DeepSeek)
function getOpenAIClient(): OpenAI {
    if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    }

    return new OpenAI({
        baseURL: "https://api.deepseek.com",
        apiKey: process.env.DEEPSEEK_API_KEY,
    });
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

                if (origParams.weight !== updParams.weight) {
                    modifications.push({
                        dayIndex,
                        actionName,
                        field: '重量',
                        oldValue: `${origParams.weight || 0}kg`,
                        newValue: `${updParams.weight || 0}kg`
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

function safeJsonPreview(input: unknown, maxLen = 800): string {
    try {
        const text = JSON.stringify(input ?? null);
        if (!text) return "null";
        return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
    } catch {
        return String(input ?? "null");
    }
}

function summarizeExecutionStatus(rows: any[]): string {
    const stats = {
        total: rows.length,
        completed: 0,
        active: 0,
        skipped: 0,
    };
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
    const interests = Array.isArray(answers.interest_tags)
        ? answers.interest_tags.map((x: any) => String(x))
        : [];
    const preferredTimes = typeof answers.times === "number" ? answers.times : null;

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
        if (preferredTimes && weekDays.includes(preferredTimes)) {
            score += 1.5;
            reasons.push("每周频次匹配");
        }

        const globalAnswers = (tpl?.global_answers && typeof tpl.global_answers === "object")
            ? tpl.global_answers as Record<string, any>
            : null;
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

        return {
            id: tpl.id,
            name: tpl.name,
            score,
            reasons: reasons.length > 0 ? reasons.join("、") : "通用候选",
        };
    });

    const top = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    return top
        .map((x, idx) => `${idx + 1}. ${x.name}（score=${x.score.toFixed(1)}，${x.reasons}）`)
        .join("\n");
}

async function buildBatchOperationContext(params: {
    userId: string;
    targetActionType: TargetActionType;
    templateId?: string;
    contextOptions?: BatchOperationContextOptions;
}): Promise<string> {
    const {
        userId,
        targetActionType,
        templateId,
        contextOptions,
    } = params;
    const options: Required<Omit<BatchOperationContextOptions, "subscriptionId">> & { subscriptionId?: string } = {
        includeProfile: contextOptions?.includeProfile ?? true,
        includeQuestionnaire: contextOptions?.includeQuestionnaire ?? true,
        includeExecutionHistory: contextOptions?.includeExecutionHistory ?? true,
        includeCoachTemplates: contextOptions?.includeCoachTemplates ?? true,
        includeTemplateMatch: contextOptions?.includeTemplateMatch ?? true,
        includeFeedbacks: contextOptions?.includeFeedbacks ?? true,
        subscriptionId: contextOptions?.subscriptionId,
    };

    let coachId: string | null = null;
    if (targetActionType === "coach" && (options.includeCoachTemplates || options.subscriptionId)) {
        const { data: coachRow } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();
        coachId = coachRow?.id || null;
    }

    let subjectUserId: string | null = targetActionType === "student" ? userId : null;
    let subscriptionQuestionnaires: Record<string, any> | null = null;

    if (options.subscriptionId && coachId) {
        const { data: subRow } = await supabase
            .from("coach_subscriptions")
            .select("id,student_id,questionnaires")
            .eq("id", options.subscriptionId)
            .eq("coach_id", coachId)
            .maybeSingle();
        if (subRow?.student_id) {
            subjectUserId = subRow.student_id;
            subscriptionQuestionnaires =
                (subRow.questionnaires && typeof subRow.questionnaires === "object")
                    ? subRow.questionnaires as Record<string, any>
                    : null;
        }
    }

    const sections: string[] = [];
    sections.push(`- 目标角色: ${targetActionType}`);
    if (subjectUserId) sections.push(`- 目标学员 user_id: ${subjectUserId}`);

    let profileRow: any = null;
    if (options.includeProfile && subjectUserId) {
        const { data } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", subjectUserId)
            .maybeSingle();
        profileRow = data || null;
        if (profileRow) {
            sections.push("## 学员档案");
            sections.push(`- fitness_goal: ${String(profileRow.fitness_goal || "未填写")}`);
            sections.push(`- fitness_level: ${String(profileRow.fitness_level || "未填写")}`);
            sections.push(`- weight: ${String(profileRow.weight || "未知")}`);
            sections.push(`- 其他档案快照: ${safeJsonPreview({
                gender: profileRow.gender,
                birthdate: profileRow.birthdate,
                injuries: profileRow.injuries,
                training_experience: profileRow.training_experience,
            }, 360)}`);
        }
    }

    let onboardingAnswers: Record<string, any> | null = null;
    if (options.includeQuestionnaire && subjectUserId) {
        const { data } = await supabase
            .from("onboarding_questionnaires")
            .select("answers,created_at")
            .eq("user_id", subjectUserId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        onboardingAnswers =
            (data?.answers && typeof data.answers === "object")
                ? data.answers as Record<string, any>
                : null;
        const finalAnswers = onboardingAnswers || subscriptionQuestionnaires;
        sections.push("## 学员问卷");
        if (finalAnswers) {
            sections.push(`- 回答摘要: ${safeJsonPreview(finalAnswers, 700)}`);
        } else {
            sections.push("- 未找到可用问卷回答");
        }
    }

    let executionRows: any[] = [];
    let instanceIds: string[] = [];
    if ((options.includeExecutionHistory || options.includeFeedbacks) && subjectUserId) {
        const { data: instances } = await supabase
            .from("coach_plan_instances")
            .select("id,name,status,updated_at")
            .eq("student_id", subjectUserId)
            .order("updated_at", { ascending: false })
            .limit(6);
        instanceIds = (instances || []).map((x: any) => x.id);

        if (options.includeExecutionHistory && instanceIds.length > 0) {
            const { data: execs } = await supabase
                .from("plan_instance_executions")
                .select("id,instance_id,day_index,status,started_at,completed_at")
                .in("instance_id", instanceIds)
                .order("started_at", { ascending: false })
                .limit(60);
            executionRows = execs || [];
            sections.push("## 历史执行摘要");
            sections.push(`- ${summarizeExecutionStatus(executionRows)}`);
            sections.push(`- 最近执行: ${safeJsonPreview(executionRows.slice(0, 5), 520)}`);
        }
    }

    if (options.includeFeedbacks && instanceIds.length > 0) {
        const { data: feedbacks } = await supabase
            .from("execution_feedbacks")
            .select("day_index,content,difficulty_rating,created_at")
            .in("instance_id", instanceIds)
            .order("created_at", { ascending: false })
            .limit(10);
        sections.push("## 学员反馈摘要");
        sections.push(
            feedbacks && feedbacks.length > 0
                ? feedbacks
                    .map((f: any) => `- 第${f.day_index}天 难度${f.difficulty_rating || "-"}: ${String(f.content || "").slice(0, 60)}`)
                    .join("\n")
                : "- 暂无近期反馈",
        );
    }

    let coachTemplates: any[] = [];
    if (options.includeCoachTemplates && coachId) {
        const { data } = await supabase
            .from("coach_plan_templates")
            .select("id,name,description,tags,suitable_for,training_days_count,week_days,global_answers,updated_at")
            .eq("coach_id", coachId)
            .order("updated_at", { ascending: false })
            .limit(12);
        coachTemplates = (data || []).filter((tpl: any) => !templateId || tpl.id !== templateId);
        sections.push("## 教练模板库摘要");
        if (coachTemplates.length > 0) {
            sections.push(
                coachTemplates
                    .slice(0, 6)
                    .map((tpl: any) =>
                        `- ${tpl.name}（suitable_for=${tpl.suitable_for || "-"}，days=${tpl.training_days_count || "-"}，tags=${Array.isArray(tpl.tags) ? tpl.tags.join("/") : "-"}`,
                    )
                    .join("\n"),
            );
        } else {
            sections.push("- 暂无可用模板");
        }
    }

    if (options.includeTemplateMatch && coachTemplates.length > 0) {
        sections.push("## 模板匹配建议（可先复用再微调）");
        sections.push(buildTemplateMatchSummary({
            templates: coachTemplates,
            fitnessLevel: profileRow?.fitness_level || null,
            questionnaireAnswers: onboardingAnswers || subscriptionQuestionnaires || null,
        }));
    }

    sections.push("## 执行权限说明");
    sections.push(
        "- 当前接口仅能修改当前计划 trainingDays；不能直接新建模板。\n" +
        "- 若你判断应沉淀为模板，请在 actionPlan 中明确提出“建议创建模板”与模板命名建议。",
    );

    return sections.join("\n");
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
        } = body;

        if (targetActionType === "coach" && !session.user.is_coach) {
            return new Response(
                JSON.stringify({ success: false, message: "Forbidden" }),
                { status: 403 },
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
                        .select('id, name, type, detail')
                        .eq(actionOwnerColumn, userId);

                    if (actionsError) {
                        throw new Error('无法加载动作库');
                    }

                    const actions = actionsData || [];

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

                    sendMessage({ type: 'progress', message: '正在构建上下文信息' });
                    const contextPrompt = await buildBatchOperationContext({
                        userId,
                        targetActionType,
                        templateId,
                        contextOptions,
                    });

                    // 首先让 AI 判断用户意图
                    sendMessage({ type: 'progress', message: '正在分析您的需求' });

                    const intentPrompt = `你是一个训练计划助手。请分析用户的指令，判断他们是想要：
1. **查询/分析** - 想了解计划中的某些信息，如统计数据、动作分布、强度分析等（不修改计划）
2. **修改** - 想要对计划进行更改、替换、添加、删除等操作

## 当前训练计划概览
- 总天数: ${trainingDays.length} 天
- 训练天数: ${trainingDays.filter((d: any) => d.type === 'training').length} 天
- 休息天数: ${trainingDays.filter((d: any) => d.type === 'rest').length} 天

## 计划详情
${JSON.stringify(trainingDays, null, 2)}

## 可用的动作列表
${actions.map(a => `- ${a.name} (type: ${a.type})`).join('\n')}
${actionsByTypePrompt}

## 额外上下文（档案/问卷/执行/模板）
${contextPrompt}

## 用户指令（含多轮对话时此处为完整上下文）
${effectiveInstruction}

请返回 JSON 格式:
{
    "intent": "query" 或 "modify",
    "reason": "简短说明判断依据"
}`;

                    const openai = getOpenAIClient();
                    const intentCompletion = await openai.chat.completions.create({
                        model: "deepseek-chat",
                        messages: [{ role: "system", content: intentPrompt }],
                        response_format: { type: "json_object" },
                        temperature: 0.1,
                        max_tokens: 200
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
${JSON.stringify(trainingDays, null, 2)}
\`\`\`

## 可用的动作列表（包含类型）
${actions.map(a => `- ${a.name} (id: ${a.id}, type: ${a.type})`).join('\n')}

## 动作类型说明
- STRENGTH: 力量训练
- CARDIO: 有氧运动
- DIET: 饮食相关
- HABIT: 习惯养成
${actionsByTypePrompt}

## 额外上下文（档案/问卷/执行/模板）
${contextPrompt}

## 用户问题（含多轮对话时此处为完整上下文）
${effectiveInstruction}

请用中文回答，格式要清晰易读。如果涉及统计，请给出具体数字。可以使用 markdown 格式（如列表、加粗等）来增强可读性。`;

                        const queryCompletion = await openai.chat.completions.create({
                            model: "deepseek-chat",
                            messages: [{ role: "system", content: queryPrompt }],
                            temperature: 0.3,
                            max_tokens: 2000
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
${actions.map(a => `${a.name} (${a.type})`).join('、')}
${actionsByTypePrompt}

## 额外上下文（档案/问卷/执行/模板）
${contextPrompt}

## 用户指令（含多轮对话时此处为完整上下文，请结合用户补充判断是否已完整）
${effectiveInstruction}

请严格返回 JSON（不要其他内容）:
{
    "complete": true 或 false,
    "clarificationQuestion": "若 complete 为 false，此处写一句简短的中文追问，例如：请说明要改成哪种具体的有氧运动（如跑步、跳绳、骑行等）？",
    "suggestions": ["若 complete 为 false，此处返回 3～6 个具体推荐选项的字符串数组，与追问内容对应。例如有氧类可填 [\"跑步\", \"跳绳\", \"骑行\", \"游泳\", \"划船\"]，力量类可填动作库中的具体动作名。用户可点击直接选用。"]
}`;
                    const clarificationCompletion = await openai.chat.completions.create({
                        model: "deepseek-chat",
                        messages: [{ role: "system", content: clarificationPrompt }],
                        response_format: { type: "json_object" },
                        temperature: 0.1,
                        max_tokens: 400
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

                    // 代码生成流程（借鉴智能导入的 training data 结构描述）
                    const systemPrompt = `你是一个训练计划批量操作助手。

## 你的任务
根据用户的自然语言指令，生成 TypeScript 代码来修改训练计划。对于动作 ID，请优先复用动作库；若未命中或用户明确要求“新动作”，必须进入待确认流程（使用 \`pending:\` 临时 ID），禁止把“新动作”硬匹配到相似旧动作。

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
        weight?: number;       // 重量 kg（STRENGTH 常用）
        rest_seconds?: number;  // 组间休息秒
        note?: string;
        // 有氧/饮食/习惯类动作可能还有 customData，见下
    };
}
\`\`\`

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

## 可用的辅助函数
- \`findActionByName(name: string)\`: 仅“规范化后全等”匹配，匹配失败返回 null
- \`findActionById(id: string)\`: 通过 id 查找动作
- \`ensureActionIdByName(name: string)\`: 优先返回已存在动作 id；若未命中返回 \`pending:xxx\`（后续会触发人工确认创建）

## 当前可用的动作列表（仅允许使用以下 id）
${actions.map(a => `- ${a.name} (id: ${a.id}, type: ${a.type})`).join('\n')}
${actionsByTypePrompt}

## 业务上下文（必须参考）
${contextPrompt}

## trainingDays 当前内容示例
${JSON.stringify(trainingDays.slice(0, 2), null, 2)}

## 用户指令（含多轮对话时此处为完整上下文，请按用户最终意图生成代码）
${effectiveInstruction}

## 请生成 TypeScript 代码
返回 JSON：
{
    "actionPlan": "一句用户友好的执行计划说明（中文）",
    "code": "<仅修改 trainingDays 的 TypeScript 代码，不要包含注释外的任何说明>"
}`;

                    // 4. 调用 AI 并执行代码（支持重试）
                    const maxRetries = 3;
                    let retryCount = 0;
                    let executionResult: any = null;
                    let lastError: string = '';
                    
                    const messages: Array<{ role: "system" | "user" | "assistant", content: string }> = [
                        { role: "system", content: systemPrompt }
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
                            const completion = await openai.chat.completions.create({
                                model: "deepseek-chat",
                                messages: messages,
                                response_format: { type: "json_object" },
                                temperature: 0.2,
                                max_tokens: 4000
                            });
                            const aiDuration = Date.now() - aiStartTime;

                            const responseContent = completion.choices[0]?.message?.content;
                            if (!responseContent) {
                                throw new Error('AI 未返回有效响应');
                            }

                            const aiResponse = JSON.parse(responseContent) as {
                                actionPlan: string;
                                code: string;
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
                                aiResponse.code,
                                trainingDays,
                                actions.map(a => ({ id: a.id, name: a.name }))
                            );

                            if (executionResult.success) {
                                // 执行成功，跳出重试循环
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
                        message: `分析完成，共发现 ${modifications.length} 处修改${isDevelopment ? ` (总耗时 ${totalDuration}ms)` : ''}`
                    });

                } catch (error: any) {
                    console.error('[batch-operation] Error:', error);
                    sendMessage({
                        type: 'error',
                        message: error.message || '操作失败'
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
