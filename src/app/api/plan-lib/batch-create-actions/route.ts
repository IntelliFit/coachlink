import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { BatchCreateActionsDto, BatchCreateActionsResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { normalizeActionNameForMatch } from "@/lib/planImportText";
import { ItemType } from "@/types";
import {
    buildCanonicalLookup,
    resolveCanonicalActionId,
} from "@/lib/canonicalActionResolver";

/**
 * 批量创建动作
 * 用于智能导入时快速创建多个新动作
 */
export async function POST(req: Request) {
    const { actions } = await req.json() as BatchCreateActionsDto;

    // 检查用户登录和教练权限
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    if (!actions || actions.length === 0) {
        return NextResponse.json({
            success: false,
            message: "请提供要创建的动作列表",
        }, { status: 400 });
    }

    try {
        // 防重复：如果动作名称已经存在于该教练动作库，则跳过创建
        const { data: existing, error: existingError } = await supabase
            .from("coach_actions")
            .select("id,name,canonical_action_id")
            .eq("coach_id", userId);

        if (existingError) {
            console.error("Error fetching existing actions:", existingError);
            return NextResponse.json({
                success: false,
                message: "获取动作库失败",
            }, { status: 500 });
        }

        const { data: canonicalActions, error: canonicalError } = await supabase
            .from("canonical_actions")
            .select("id,name,aliases");
        if (canonicalError) {
            return NextResponse.json({
                success: false,
                message: "获取 canonical 动作库失败",
            }, { status: 500 });
        }
        const canonicalLookup = buildCanonicalLookup((canonicalActions as any[]) || []);

        const existingNameSet = new Set<string>();
        const existingCanonicalSet = new Set<string>();
        for (const row of existing || []) {
            existingNameSet.add(normalizeActionNameForMatch((row as any).name || ""));
            if ((row as any).canonical_action_id) {
                existingCanonicalSet.add((row as any).canonical_action_id);
            }
        }

        const resolvedBatch = actions.map((action) => {
            const itemType = normalizeItemType((action as any).type);
            const resolved = resolveCanonicalActionId(canonicalLookup, {
                actionName: action.name,
                providedCanonicalId: (action as any).canonical_action_id,
                requireCanonical: true,
                pickFirstOnAmbiguous: true, // 智能导入：多匹配取首项，避免阻断
            });
            return { action, itemType, resolved };
        });

        // 未匹配到 canonical 时自动创建（与 add-action 一致），不报错
        const notFoundByName = new Map<string, string>();
        for (const { action, resolved } of resolvedBatch) {
            if (resolved.reason === "not_found") {
                const key = normalizeActionNameForMatch(action.name);
                if (key && !notFoundByName.has(key)) {
                    notFoundByName.set(key, action.name.trim());
                }
            }
        }
        const createdCanonicalIds = new Map<string, string>();
        for (const [normKey, actionName] of notFoundByName) {
            const generatedCanonicalId = `custom_${crypto.randomUUID()}`;
            const { error: createErr } = await supabase
                .from("canonical_actions")
                .insert({
                    id: generatedCanonicalId,
                    name: actionName,
                    aliases: [],
                    category: null,
                    created_at: new Date().toISOString(),
                } as any);
            if (createErr) {
                return NextResponse.json({
                    success: false,
                    message: `创建 canonical 动作失败: ${createErr.message}`,
                }, { status: 500 });
            }
            createdCanonicalIds.set(normKey, generatedCanonicalId);
        }

        const enrichedBatch = resolvedBatch.map(({ action, itemType, resolved }) => {
            let canonicalActionId = resolved.canonicalActionId;
            if (resolved.reason === "not_found") {
                const key = normalizeActionNameForMatch(action.name);
                canonicalActionId = key ? (createdCanonicalIds.get(key) ?? null) : null;
            }
            return { action, itemType, canonicalActionId };
        });

        const hasOtherErrors = resolvedBatch.some(
            (x) => x.resolved.errorMessage && x.resolved.reason !== "not_found",
        );
        if (hasOtherErrors) {
            const bad = resolvedBatch.find(
                (x) => x.resolved.errorMessage && x.resolved.reason !== "not_found",
            );
            return NextResponse.json({
                success: false,
                message: bad!.resolved.errorMessage,
            }, { status: 400 });
        }

        const requestNameSet = new Set<string>();
        const requestCanonicalSet = new Set<string>();
        const uniqueToCreate = enrichedBatch.filter(({ action, canonicalActionId }) => {
            const key = normalizeActionNameForMatch(action.name);
            if (!key) return false;
            const canonicalId = canonicalActionId || "";

            const duplicatedInDb = existingNameSet.has(key) ||
                (canonicalId ? existingCanonicalSet.has(canonicalId) : false);
            if (duplicatedInDb) return false;

            const duplicatedInPayload = requestNameSet.has(key) ||
                (canonicalId ? requestCanonicalSet.has(canonicalId) : false);
            if (duplicatedInPayload) return false;

            requestNameSet.add(key);
            if (canonicalId) requestCanonicalSet.add(canonicalId);
            return true;
        });

        // 批量插入动作
        const defaultAttrsByType: Record<ItemType, string[]> = {
            STRENGTH: ["组数", "次数", "强度", "休息时间"],
            CARDIO: ["距离", "配速", "持续时间"],
            DIET: ["食物清单", "热量", "宏量营养"],
            HABIT: ["目标数值", "完成状态"],
        };

        const actionsToInsert = uniqueToCreate.map(({ action, itemType, canonicalActionId }) => {
            const attrs = (action as any).attrs?.length
                ? (action as any).attrs
                : defaultAttrsByType[itemType];
            return {
                coach_id: userId,
                name: action.name,
                type: itemType,
                detail: (action as any).detail?.trim()
                    ? (action as any).detail
                    : null,
                positions: (action as any).positions?.length
                    ? (action as any).positions
                    : ["全身"], // 默认位置
                attrs,
                url: (action as any).url?.trim() ? (action as any).url : null,
                enableAutoWeightCompute: itemType === "STRENGTH"
                    ? action.needsAutoCompute
                    : false,
                includesBodyWeight: itemType === "STRENGTH"
                    ? action.includesBodyWeight
                    : false,
                canonical_action_id: canonicalActionId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
        });

        const createdActions: any[] = [];
        if (actionsToInsert.length > 0) {
            const { data, error } = await supabase
                .from("coach_actions")
                .insert(actionsToInsert)
                .select();

            if (error) {
                console.error("Error creating actions:", error);
                return NextResponse.json({
                    success: false,
                    message: "创建动作失败",
                }, { status: 500 });
            }
            createdActions.push(...(data || []));
        }

        const skipped = actions.length - uniqueToCreate.length;

        return NextResponse.json<ApiData<BatchCreateActionsResponseDto>>({
            success: true,
            message: `成功创建 ${createdActions?.length || 0} 个动作${
                skipped > 0 ? `（已跳过 ${skipped} 个同名重复动作）` : ""
            }`,
            data: {
                createdActions: createdActions || [],
            },
        });
    } catch (error) {
        console.error("Error batch creating actions:", error);
        return NextResponse.json({
            success: false,
            message: "批量创建动作失败",
        }, { status: 500 });
    }
}

function normalizeItemType(input?: unknown): ItemType {
    const raw = String(input ?? "").toUpperCase();
    if (raw === "CARDIO" || raw === "DIET" || raw === "HABIT") return raw;
    return "STRENGTH";
}
