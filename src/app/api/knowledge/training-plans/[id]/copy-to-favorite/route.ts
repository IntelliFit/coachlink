import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type { ItemType } from "@/types/student";
import {
    buildCanonicalLookup,
    resolveCanonicalActionId,
} from "@/lib/canonicalActionResolver";
import { normalizeActionNameForMatch } from "@/lib/planImportText";
import {
    expandTrainingDays,
    getPublishedTrainingPlanByIdOrSlug,
} from "../../_helpers";

type TemplateActionRequirement = {
    key: string;
    name: string;
    type: ItemType;
    attrs: string[];
};

const DEFAULT_ATTRS_BY_TYPE: Record<ItemType, string[]> = {
    STRENGTH: ["组数", "次数", "强度", "休息时间"],
    CARDIO: ["距离", "配速", "持续时间"],
    DIET: ["食物清单", "热量", "宏量营养"],
    HABIT: ["完成状态"],
};

const PLACEHOLDER_ACTION_DEFAULTS: Record<string, string> = {
    "主项动作 A": "深蹲",
    "主项动作 B": "卧推",
    "主项动作 C": "硬拉",
    "水平推": "卧推",
    "水平拉": "杠铃划船",
    "垂直推": "站姿推举",
    "垂直拉": "引体向上",
    "辅助动作": "罗马尼亚硬拉",
    "核心稳定": "平板支撑",
};

function buildFavoriteDescription(template: any) {
    return [
        template.description,
        template.audience ? `适用人群：${template.audience}` : "",
        template.template_kind === "parameterized"
            ? "说明：这是可参数化模板，已先按默认动作加入我的计划；后续可在计划编辑器里替换动作并配置 1RM。"
            : "说明：这是平台公共训练计划模板，加入我的计划后可继续编辑。",
    ].filter(Boolean).join("\n");
}

function normalizeItemType(value: unknown): ItemType {
    const raw = String(value || "").trim().toUpperCase();
    if (raw === "CARDIO" || raw === "DIET" || raw === "HABIT") return raw;
    return "STRENGTH";
}

function firstConcreteActionName(name: string) {
    const trimmed = String(name || "").trim();
    if (!trimmed) return "";
    const [first] = trimmed
        .split(/或|\/|、/)
        .map((part) => part.trim())
        .filter(Boolean);
    return first || trimmed;
}

function getTemplateSlotDefaults(template: any) {
    const slots = Array.isArray(template?.action_slots) ? template.action_slots : [];
    const byLabel = new Map<string, string>();
    const byKey = new Map<string, string>();

    for (const slot of slots) {
        const fallback = firstConcreteActionName(slot?.defaultActionName || "");
        if (!fallback) continue;
        if (slot?.label) byLabel.set(String(slot.label).trim(), fallback);
        if (slot?.key) byKey.set(String(slot.key).trim(), fallback);
    }

    return { byLabel, byKey };
}

function resolveTemplateActionName(template: any, actionSet: any) {
    const rawName = String(
        actionSet?.actionName ||
        actionSet?.action_name ||
        actionSet?.setName ||
        actionSet?.set_name ||
        "",
    ).trim();

    const { byLabel, byKey } = getTemplateSlotDefaults(template);
    const slotName = byLabel.get(rawName) ||
        byKey.get(String(actionSet?.slotKey || actionSet?.slot_key || "").trim());
    if (slotName) return slotName;

    const placeholderDefault = PLACEHOLDER_ACTION_DEFAULTS[rawName];
    if (placeholderDefault) return placeholderDefault;

    return firstConcreteActionName(rawName);
}

function inferAttrsForAction(type: ItemType, params: Record<string, any>) {
    if (type !== "STRENGTH") {
        return DEFAULT_ATTRS_BY_TYPE[type];
    }

    const repsText = String(params?.["次数"] ?? params?.reps ?? "").trim();
    if (/秒|分钟|min|sec|s$/i.test(repsText)) {
        return ["组数", "持续时间", "休息时间"];
    }

    return DEFAULT_ATTRS_BY_TYPE.STRENGTH;
}

function shouldWriteLegacyStrength(raw: unknown) {
    if (raw === null || raw === undefined) return false;
    if (typeof raw === "number") return Number.isFinite(raw) && raw > 0;
    const text = String(raw).trim();
    return /^\d+(\.\d+)?$/.test(text) || /^\d+(\.\d+)?\s*RM$/i.test(text);
}

function parseIntensityConfig(raw: unknown) {
    const text = String(raw ?? "").trim();
    if (!text) return null;

    const percentageMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentageMatch) {
        return {
            relativeIntensity: {
                type: "percentage" as const,
                value: Number(percentageMatch[1]),
            },
        };
    }

    const rmMatch = text.match(/^(\d+(?:\.\d+)?)\s*RM$/i);
    if (rmMatch) {
        return {
            relativeIntensity: {
                type: "rm" as const,
                value: Number(rmMatch[1]),
            },
        };
    }

    return null;
}

function normalizeActionSetForFavorite(params: {
    template: any;
    actionSet: any;
    actionId: string;
    actionName: string;
}) {
    const { template, actionSet, actionId, actionName } = params;
    const itemType = normalizeItemType(actionSet?.itemType || actionSet?.item_type);
    const rawParams = { ...(actionSet?.params || {}) };

    const sets = rawParams["组数"] ?? rawParams.sets ?? actionSet?.sets ?? 1;
    const reps = rawParams["次数"] ?? rawParams.reps ?? actionSet?.reps ?? "";
    const restSeconds = rawParams["休息时间"] ?? rawParams.rest_seconds ??
        actionSet?.rest_seconds ?? 90;
    const rawIntensity = rawParams["强度"] ?? rawParams.intensity ?? actionSet?.intensity;

    const nextParams: Record<string, any> = {
        ...rawParams,
        sets,
        reps,
        rest_seconds: restSeconds,
        "组数": sets,
        "次数": reps,
        "休息时间": restSeconds,
    };

    if (rawIntensity !== undefined && rawIntensity !== null && String(rawIntensity).trim()) {
        nextParams.intensity = rawIntensity;
        const intensityConfig = parseIntensityConfig(rawIntensity);
        if (intensityConfig) {
            nextParams.intensityConfig = intensityConfig;
        }
        if (shouldWriteLegacyStrength(rawIntensity)) {
            const rmMatch = String(rawIntensity).trim().match(/^(\d+(?:\.\d+)?)\s*RM$/i);
            nextParams["强度"] = rmMatch ? Number(rmMatch[1]) : rawIntensity;
        } else {
            delete nextParams["强度"];
        }
    }

    return {
        ...actionSet,
        type: actionSet?.type || "no-filter",
        itemType,
        item_type: itemType,
        actionId,
        action_id: actionId,
        actionName,
        action_name: actionName,
        setName: actionSet?.setName || actionSet?.set_name || actionName,
        set_name: actionSet?.set_name || actionSet?.setName || actionName,
        sets,
        reps,
        rest_seconds: restSeconds,
        params: nextParams,
        templateSource: template?.slug ? "public_training_plan_template" : undefined,
    };
}

function collectActionRequirements(template: any, trainingDays: any[]) {
    const requirements = new Map<string, TemplateActionRequirement>();

    for (const day of trainingDays) {
        if (String(day?.type || "training") === "rest") continue;
        const actionSets = Array.isArray(day?.actionSets) ? day.actionSets : [];

        for (const actionSet of actionSets) {
            const actionName = resolveTemplateActionName(template, actionSet);
            if (!actionName) continue;
            const itemType = normalizeItemType(actionSet?.itemType || actionSet?.item_type);
            const attrs = inferAttrsForAction(itemType, actionSet?.params || {});
            const key = `${itemType}:${normalizeActionNameForMatch(actionName)}`;
            if (!key || requirements.has(key)) continue;
            requirements.set(key, { key, name: actionName, type: itemType, attrs });
        }
    }

    return Array.from(requirements.values());
}

async function fetchPublicActionByName(name: string) {
    const { data } = await (supabase as any)
        .from("community_actions")
        .select("*")
        .eq("name", name)
        .limit(10);
    const normalizedTarget = normalizeActionNameForMatch(name);
    return (data || []).find(
        (row: any) => normalizeActionNameForMatch(row.name || "") === normalizedTarget,
    ) || null;
}

async function fetchPublicActionByCanonical(canonicalActionId: string) {
    const { data } = await (supabase as any)
        .from("community_actions")
        .select("*")
        .eq("canonical_action_id", canonicalActionId)
        .order("like_count", { ascending: false })
        .limit(1)
        .maybeSingle();
    return data || null;
}

async function resolveAndEnsureStudentActions(
    userId: string,
    requirements: TemplateActionRequirement[],
) {
    const resolvedByKey = new Map<string, any>();
    if (requirements.length === 0) return resolvedByKey;

    const { data: existingActions, error: existingError } = await (supabase as any)
        .from("student_actions")
        .select("*")
        .eq("user_id", userId);
    if (existingError) {
        throw new Error(`读取动作库失败: ${existingError.message}`);
    }

    const existingByName = new Map<string, any>();
    const existingByCanonical = new Map<string, any>();
    for (const row of existingActions || []) {
        existingByName.set(normalizeActionNameForMatch(row.name || ""), row);
        if (row.canonical_action_id) existingByCanonical.set(row.canonical_action_id, row);
    }

    const { data: canonicalActions, error: canonicalError } = await (supabase as any)
        .from("canonical_actions")
        .select("id,name,aliases");
    if (canonicalError) {
        throw new Error(`读取 canonical 动作库失败: ${canonicalError.message}`);
    }
    const canonicalLookup = buildCanonicalLookup((canonicalActions as any[]) || []);

    for (const requirement of requirements) {
        const normalizedName = normalizeActionNameForMatch(requirement.name);
        const existingByExactName = existingByName.get(normalizedName);
        if (existingByExactName) {
            resolvedByKey.set(requirement.key, existingByExactName);
            continue;
        }

        const canonicalResolved = resolveCanonicalActionId(canonicalLookup, {
            actionName: requirement.name,
            requireCanonical: true,
            pickFirstOnAmbiguous: true,
        });
        let canonicalActionId = canonicalResolved.canonicalActionId;

        if (canonicalActionId && existingByCanonical.has(canonicalActionId)) {
            resolvedByKey.set(requirement.key, existingByCanonical.get(canonicalActionId));
            continue;
        }

        let publicAction = await fetchPublicActionByName(requirement.name);
        if (!publicAction && canonicalActionId) {
            publicAction = await fetchPublicActionByCanonical(canonicalActionId);
        }

        if (publicAction?.canonical_action_id && existingByCanonical.has(publicAction.canonical_action_id)) {
            resolvedByKey.set(
                requirement.key,
                existingByCanonical.get(publicAction.canonical_action_id),
            );
            continue;
        }

        if (!canonicalActionId) {
            if (canonicalResolved.reason && canonicalResolved.reason !== "not_found") {
                throw new Error(canonicalResolved.errorMessage || `动作 ${requirement.name} 匹配失败`);
            }
            const generatedCanonicalId = `public_tpl_${crypto.randomUUID()}`;
            const { error: createCanonicalError } = await (supabase as any)
                .from("canonical_actions")
                .insert({
                    id: generatedCanonicalId,
                    name: requirement.name,
                    aliases: [],
                    category: null,
                    created_at: new Date().toISOString(),
                });
            if (createCanonicalError) {
                throw new Error(`创建 canonical 动作失败: ${createCanonicalError.message}`);
            }
            canonicalActionId = generatedCanonicalId;
        }

        const publicType = normalizeItemType(publicAction?.type || requirement.type);
        const insertPayload = {
            user_id: userId,
            name: publicAction?.name || requirement.name,
            detail: publicAction?.detail || null,
            positions: publicType === "STRENGTH"
                ? (publicAction?.positions || ["全身"])
                : null,
            attrs: publicAction?.attrs || requirement.attrs || DEFAULT_ATTRS_BY_TYPE[publicType],
            url: publicAction?.url || null,
            type: publicType,
            item_schema: publicAction?.item_schema || null,
            suggested_time: publicAction?.suggested_time || null,
            enableAutoWeightCompute: publicType === "STRENGTH"
                ? Boolean(publicAction?.enableAutoWeightCompute)
                : false,
            includesBodyWeight: publicType === "STRENGTH"
                ? Boolean(publicAction?.includesBodyWeight && publicAction?.enableAutoWeightCompute)
                : false,
            canonical_action_id: publicAction?.canonical_action_id || canonicalActionId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { data: inserted, error: insertError } = await (supabase as any)
            .from("student_actions")
            .insert(insertPayload)
            .select("*")
            .single();
        if (insertError || !inserted) {
            const { data: racedExisting } = await (supabase as any)
                .from("student_actions")
                .select("*")
                .eq("user_id", userId)
                .eq("name", insertPayload.name)
                .maybeSingle();
            if (racedExisting) {
                resolvedByKey.set(requirement.key, racedExisting);
                continue;
            }
            throw new Error(
                `补齐动作 ${requirement.name} 失败: ${insertError?.message || "未知错误"}`,
            );
        }

        existingByName.set(normalizeActionNameForMatch(inserted.name || ""), inserted);
        if (inserted.canonical_action_id) {
            existingByCanonical.set(inserted.canonical_action_id, inserted);
        }
        resolvedByKey.set(requirement.key, inserted);
    }

    return resolvedByKey;
}

async function bindTrainingDaysToStudentActions(userId: string, template: any, trainingDays: any[]) {
    const requirements = collectActionRequirements(template, trainingDays);
    const actionMap = await resolveAndEnsureStudentActions(userId, requirements);

    return trainingDays.map((day) => {
        const actionSets = Array.isArray(day?.actionSets) ? day.actionSets : [];
        const nextActionSets = actionSets.map((actionSet: any) => {
            const actionName = resolveTemplateActionName(template, actionSet);
            const itemType = normalizeItemType(actionSet?.itemType || actionSet?.item_type);
            const key = `${itemType}:${normalizeActionNameForMatch(actionName)}`;
            const action = actionMap.get(key);

            return normalizeActionSetForFavorite({
                template,
                actionSet,
                actionId: String(action?.id || ""),
                actionName: String(action?.name || actionName),
            });
        });

        return {
            ...day,
            actionSets: nextActionSets,
            actionSetsCount: nextActionSets.length,
        };
    });
}

export async function POST(
    _req: Request,
    context: { params: Promise<{ id: string }> },
) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;
    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    const { id } = await context.params;
    const template = await getPublishedTrainingPlanByIdOrSlug(decodeURIComponent(id))
        .catch((error) => {
            console.error("[knowledge/training-plans] copy load failed:", error);
            return null;
        });

    if (!template) {
        return NextResponse.json({
            success: false,
            message: "训练计划模板不存在",
        }, { status: 404 });
    }

    const trainingDays = expandTrainingDays(template.training_days, template.weeks);
    if (trainingDays.length === 0) {
        return NextResponse.json({
            success: false,
            message: "训练计划模板内容为空",
        }, { status: 400 });
    }

    let boundTrainingDays: any[];
    try {
        boundTrainingDays = await bindTrainingDaysToStudentActions(userId, template, trainingDays);
    } catch (error: any) {
        console.error("[knowledge/training-plans] bind actions failed:", error);
        return NextResponse.json({
            success: false,
            message: error?.message || "训练计划动作匹配失败",
        }, { status: 500 });
    }

    const { data: favorite, error } = await supabase
        .from("student_plan_favorites")
        .insert({
            user_id: userId,
            name: template.name,
            description: buildFavoriteDescription(template),
            training_days: boundTrainingDays,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error("[knowledge/training-plans] copy failed:", error);
        return NextResponse.json({
            success: false,
            message: `加入我的计划失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<{ favorite: any }>>({
        success: true,
        message: "已加入我的计划",
        data: { favorite },
    });
}
