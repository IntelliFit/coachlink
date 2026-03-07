import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ItemType } from "@/types";
import { normalizeActionNameForMatch } from "@/lib/planImportText";
import {
    buildCanonicalLookup,
    resolveCanonicalActionId,
} from "@/lib/canonicalActionResolver";

interface ConfirmActionItem {
    tempActionId: string;
    decision: "use_existing" | "create_new";
    existingActionId?: string | null;
    createPayload?: {
        name: string;
        type: ItemType;
        attrs: string[];
        needsAutoCompute?: boolean;
        includesBodyWeight?: boolean;
        detail?: string;
        url?: string;
        positions?: string[];
    } | null;
}

interface ConfirmBatchActionsDto {
    actions: ConfirmActionItem[];
    targetActionType?: "coach" | "student";
}

const ATTR_PROFILES_BY_TYPE: Record<ItemType, string[][]> = {
    STRENGTH: [
        ["组数", "次数", "强度", "休息时间"],
        ["组数", "持续时间", "强度", "休息时间"],
        ["组数", "次数", "休息时间"],
        ["组数", "持续时间", "休息时间"],
    ],
    CARDIO: [
        ["距离", "配速", "持续时间"],
        ["冲刺时长", "间歇时长", "循环次数", "强度"],
    ],
    DIET: [
        ["食物清单", "热量", "宏量营养"],
        ["摄入量", "时间点"],
    ],
    HABIT: [
        ["目标数值", "完成状态"],
        ["完成状态"],
    ],
};

function normalizeItemType(input?: unknown): ItemType {
    const raw = String(input ?? "").toUpperCase();
    if (raw === "CARDIO" || raw === "DIET" || raw === "HABIT") return raw;
    return "STRENGTH";
}

function attrsMatchProfile(type: ItemType, attrs: string[]): boolean {
    const profiles = ATTR_PROFILES_BY_TYPE[type] || [];
    return profiles.some((profile) =>
        profile.length === attrs.length &&
        profile.every((v, i) => attrs[i] === v),
    );
}

type ActionOwnerConfig = {
    table: "coach_actions" | "student_actions";
    ownerColumn: "coach_id" | "user_id";
};

function getOwnerConfig(targetActionType?: "coach" | "student"): ActionOwnerConfig {
    return targetActionType === "student"
        ? { table: "student_actions", ownerColumn: "user_id" }
        : { table: "coach_actions", ownerColumn: "coach_id" };
}

async function findPublicActionMatch(actionName: string, canonicalActionId: string | null) {
    // 1) canonical 优先，避免同名异义
    if (canonicalActionId) {
        const { data: canonicalMatched } = await supabase
            .from("community_actions")
            .select("*")
            .eq("canonical_action_id", canonicalActionId)
            .order("like_count", { ascending: false })
            .limit(5);
        if (canonicalMatched && canonicalMatched.length > 0) {
            const exactName = canonicalMatched.find(
                (row: any) => normalizeActionNameForMatch(row.name || "") === normalizeActionNameForMatch(actionName),
            );
            return exactName || canonicalMatched[0];
        }
    }

    // 2) 名称规范化全等匹配（大小写/空格/符号差异容忍）
    const { data: nameMatched } = await supabase
        .from("community_actions")
        .select("*")
        .ilike("name", actionName)
        .limit(20);
    const normalizedTarget = normalizeActionNameForMatch(actionName);
    const exact = (nameMatched || []).find(
        (row: any) => normalizeActionNameForMatch(row.name || "") === normalizedTarget,
    );
    return exact || null;
}

export async function POST(req: NextRequest) {
    const session = await getServerSession();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Unauthorized", data: null },
            { status: 401 },
        );
    }

    try {
        const body = await req.json() as ConfirmBatchActionsDto;
        const targetActionType = body.targetActionType || "coach";
        if (targetActionType === "coach" && !session.user.is_coach) {
            return NextResponse.json(
                { success: false, message: "Forbidden", data: null },
                { status: 403 },
            );
        }

        const { table: targetTable, ownerColumn } = getOwnerConfig(targetActionType);
        const items = body.actions || [];
        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { success: false, message: "缺少待确认动作", data: null },
                { status: 400 },
            );
        }

        const { data: ownerActions, error: ownerActionsError } = await supabase
            .from(targetTable)
            .select("id,name,canonical_action_id,type")
            .eq(ownerColumn, userId);
        if (ownerActionsError) {
            return NextResponse.json(
                { success: false, message: "读取动作库失败", data: null },
                { status: 500 },
            );
        }

        const { data: canonicalActions, error: canonicalError } = await supabase
            .from("canonical_actions")
            .select("id,name,aliases");
        if (canonicalError) {
            return NextResponse.json(
                { success: false, message: "读取 canonical 动作库失败", data: null },
                { status: 500 },
            );
        }
        const canonicalLookup = buildCanonicalLookup((canonicalActions as any[]) || []);

        const existingById = new Map<string, any>();
        const existingByName = new Map<string, any>();
        const existingByCanonical = new Map<string, any>();
        for (const row of ownerActions || []) {
            existingById.set(row.id, row);
            existingByName.set(normalizeActionNameForMatch(row.name || ""), row);
            if ((row as any).canonical_action_id) {
                existingByCanonical.set((row as any).canonical_action_id, row);
            }
        }

        const actionIdMapping: Record<string, string> = {};
        const createdActions: Array<{ id: string; name: string; type: ItemType; attrs: string[] | null }> = [];
        const seenTempIds = new Set<string>();

        for (const item of items) {
            const tempActionId = String(item.tempActionId || "").trim();
            if (!tempActionId) {
                return NextResponse.json(
                    { success: false, message: "存在空的 tempActionId", data: null },
                    { status: 400 },
                );
            }
            if (seenTempIds.has(tempActionId)) continue;
            seenTempIds.add(tempActionId);

            if (item.decision === "use_existing") {
                const existingId = String(item.existingActionId || "").trim();
                const existing = existingById.get(existingId);
                if (!existing) {
                    return NextResponse.json(
                        { success: false, message: `动作映射失败：未找到已有动作 ${existingId}`, data: null },
                        { status: 400 },
                    );
                }
                actionIdMapping[tempActionId] = existing.id;
                continue;
            }

            const payload = item.createPayload;
            if (!payload || !payload.name?.trim()) {
                return NextResponse.json(
                    { success: false, message: `动作 ${tempActionId} 缺少新建名称`, data: null },
                    { status: 400 },
                );
            }

            const actionName = payload.name.trim();
            const itemType = normalizeItemType(payload.type);
            const attrs = (payload.attrs || []).map((x) => String(x).trim()).filter(Boolean);
            if (!attrsMatchProfile(itemType, attrs)) {
                return NextResponse.json(
                    { success: false, message: `动作「${actionName}」的属性组合不符合 ${itemType} 预设模板`, data: null },
                    { status: 400 },
                );
            }

            const normalizedName = normalizeActionNameForMatch(actionName);
            const dupByName = existingByName.get(normalizedName);
            if (dupByName) {
                actionIdMapping[tempActionId] = dupByName.id;
                continue;
            }

            // 优先：从公共动作库复用
            // 命中公共库时，直接采用公共动作对应 canonical，不做全局同名歧义拦截
            const publicMatched = await findPublicActionMatch(actionName, null);
            if (publicMatched) {
                const canonicalActionId = (publicMatched as any).canonical_action_id || null;
                if (canonicalActionId && existingByCanonical.has(canonicalActionId)) {
                    const existed = existingByCanonical.get(canonicalActionId);
                    actionIdMapping[tempActionId] = existed.id;
                    continue;
                }
                const publicType = normalizeItemType((publicMatched as any).type || itemType);
                const insertFromPublic = {
                    [ownerColumn]: userId,
                    name: (publicMatched as any).name || actionName,
                    type: publicType,
                    attrs: ((publicMatched as any).attrs && (publicMatched as any).attrs.length > 0)
                        ? (publicMatched as any).attrs
                        : attrs,
                    detail: (publicMatched as any).detail?.trim()
                        ? (publicMatched as any).detail
                        : (payload.detail?.trim() ? payload.detail.trim() : null),
                    url: (publicMatched as any).url?.trim()
                        ? (publicMatched as any).url
                        : (payload.url?.trim() ? payload.url.trim() : null),
                    positions: publicType === "STRENGTH"
                        ? (
                            ((publicMatched as any).positions && (publicMatched as any).positions.length > 0)
                                ? (publicMatched as any).positions
                                : ((payload.positions && payload.positions.length > 0) ? payload.positions : ["全身"])
                        )
                        : null,
                    enableAutoWeightCompute: publicType === "STRENGTH"
                        ? Boolean((publicMatched as any).enableAutoWeightCompute ?? payload.needsAutoCompute)
                        : false,
                    includesBodyWeight: publicType === "STRENGTH"
                        ? Boolean((publicMatched as any).includesBodyWeight ?? payload.includesBodyWeight)
                        : false,
                    canonical_action_id: (publicMatched as any).canonical_action_id || canonicalActionId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                const { data: insertedPublic, error: insertPublicError } = await supabase
                    .from(targetTable)
                    .insert(insertFromPublic)
                    .select("id,name,type,attrs,canonical_action_id")
                    .single();
                if (insertPublicError || !insertedPublic) {
                    return NextResponse.json(
                        { success: false, message: `复用公共动作「${actionName}」失败: ${insertPublicError?.message || "未知错误"}`, data: null },
                        { status: 500 },
                    );
                }

                existingById.set(insertedPublic.id, insertedPublic);
                existingByName.set(normalizeActionNameForMatch(insertedPublic.name || ""), insertedPublic);
                if ((insertedPublic as any).canonical_action_id) {
                    existingByCanonical.set((insertedPublic as any).canonical_action_id, insertedPublic);
                }
                actionIdMapping[tempActionId] = insertedPublic.id;
                createdActions.push({
                    id: insertedPublic.id,
                    name: insertedPublic.name,
                    type: normalizeItemType(insertedPublic.type),
                    attrs: insertedPublic.attrs || null,
                });
                continue;
            }

            const canonicalResolved = resolveCanonicalActionId(canonicalLookup, {
                actionName,
                requireCanonical: true,
            });
            let canonicalActionId = canonicalResolved.canonicalActionId;

            if (canonicalResolved.errorMessage && canonicalResolved.reason !== "not_found") {
                return NextResponse.json(
                    { success: false, message: canonicalResolved.errorMessage, data: null },
                    { status: 400 },
                );
            }

            if (canonicalActionId && existingByCanonical.has(canonicalActionId)) {
                const existed = existingByCanonical.get(canonicalActionId);
                actionIdMapping[tempActionId] = existed.id;
                continue;
            }

            if (canonicalResolved.reason === "not_found") {
                const generatedCanonicalId = `custom_${crypto.randomUUID()}`;
                const { error: createCanonicalError } = await supabase
                    .from("canonical_actions")
                    .insert({
                        id: generatedCanonicalId,
                        name: actionName,
                        aliases: [],
                        category: null,
                        created_at: new Date().toISOString(),
                    } as any);
                if (createCanonicalError) {
                    return NextResponse.json(
                        { success: false, message: `创建 canonical 动作失败: ${createCanonicalError.message}`, data: null },
                        { status: 500 },
                    );
                }
                canonicalActionId = generatedCanonicalId;
            }

            const insertPayload = {
                [ownerColumn]: userId,
                name: actionName,
                type: itemType,
                attrs,
                detail: payload.detail?.trim() ? payload.detail.trim() : null,
                url: payload.url?.trim() ? payload.url.trim() : null,
                positions: itemType === "STRENGTH"
                    ? ((payload.positions && payload.positions.length > 0) ? payload.positions : ["全身"])
                    : null,
                enableAutoWeightCompute: itemType === "STRENGTH" ? Boolean(payload.needsAutoCompute) : false,
                includesBodyWeight: itemType === "STRENGTH" ? Boolean(payload.includesBodyWeight) : false,
                canonical_action_id: canonicalActionId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            const { data: inserted, error: insertError } = await supabase
                .from(targetTable)
                .insert(insertPayload)
                .select("id,name,type,attrs,canonical_action_id")
                .single();
            if (insertError || !inserted) {
                return NextResponse.json(
                    { success: false, message: `创建动作「${actionName}」失败: ${insertError?.message || "未知错误"}`, data: null },
                    { status: 500 },
                );
            }

            existingById.set(inserted.id, inserted);
            existingByName.set(normalizedName, inserted);
            if ((inserted as any).canonical_action_id) {
                existingByCanonical.set((inserted as any).canonical_action_id, inserted);
            }

            actionIdMapping[tempActionId] = inserted.id;
            createdActions.push({
                id: inserted.id,
                name: inserted.name,
                type: normalizeItemType(inserted.type),
                attrs: inserted.attrs || null,
            });
        }

        return NextResponse.json({
            success: true,
            message: "动作确认完成",
            data: {
                actionIdMapping,
                createdActions,
            },
        });
    } catch (error: any) {
        console.error("[confirm-batch-actions] Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "动作确认失败", data: null },
            { status: 500 },
        );
    }
}

