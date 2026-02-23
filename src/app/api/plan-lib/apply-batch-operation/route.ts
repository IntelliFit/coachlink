import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ItemType } from "@/types";

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

function collectActionRefs(trainingDays: any[]): Array<{ actionId: string; itemType?: ItemType | null }> {
    const refs: Array<{ actionId: string; itemType?: ItemType | null }> = [];
    for (const day of trainingDays || []) {
        for (const set of day?.actionSets || []) {
            if (set?.actionId) {
                refs.push({
                    actionId: String(set.actionId),
                    itemType: set.itemType ? normalizeItemType(set.itemType) : null,
                });
            }
            if (set?.type === "one-filter" && Array.isArray(set?.actions)) {
                for (const inner of set.actions) {
                    if (inner?.actionId) {
                        refs.push({
                            actionId: String(inner.actionId),
                            itemType: inner.itemType ? normalizeItemType(inner.itemType) : null,
                        });
                    }
                }
            }
        }
    }
    return refs;
}

/**
 * 应用批量操作的修改到数据库
 */
export async function POST(req: NextRequest) {
    // 验证用户身份
    const session = await getServerSession();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const body = await req.json();
        const {
            templateId,
            updatedTrainingDays,
            targetActionType = "coach",
        } = body as {
            templateId?: string;
            updatedTrainingDays?: any[];
            targetActionType?: TargetActionType;
        };

        if (targetActionType === "coach" && !session.user.is_coach) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 },
            );
        }

        if (!templateId || !updatedTrainingDays) {
            return NextResponse.json(
                { success: false, message: "缺少必要参数" },
                { status: 400 }
            );
        }

        const { table: actionTable, ownerColumn: actionOwnerColumn } =
            getActionOwnerConfig(targetActionType);
        const actionRefs = collectActionRefs(updatedTrainingDays);
        const uniqueActionIds = Array.from(new Set(actionRefs.map((x) => x.actionId)));
        const actionTypeMap = new Map<string, ItemType>();
        if (uniqueActionIds.length > 0) {
            const { data: actionRows, error: actionError } = await supabase
                .from(actionTable)
                .select("id,type")
                .eq(actionOwnerColumn, userId)
                .in("id", uniqueActionIds);
            if (actionError) {
                return NextResponse.json(
                    { success: false, message: "校验动作库失败" },
                    { status: 500 },
                );
            }
            for (const row of actionRows || []) {
                actionTypeMap.set(row.id, normalizeItemType(row.type));
            }
        }

        const unknownIds = uniqueActionIds.filter((id) => !actionTypeMap.has(id));
        if (unknownIds.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: `存在未确认动作，请先完成动作确认：${unknownIds.slice(0, 5).join("、")}${unknownIds.length > 5 ? "..." : ""}`,
                },
                { status: 400 },
            );
        }

        const mismatch = actionRefs.find((ref) =>
            ref.itemType && actionTypeMap.get(ref.actionId) && ref.itemType !== actionTypeMap.get(ref.actionId),
        );
        if (mismatch) {
            return NextResponse.json(
                { success: false, message: `动作类型不一致：${mismatch.actionId}` },
                { status: 400 },
            );
        }

        const { table: planTable, ownerColumn: planOwnerColumn } =
            getPlanOwnerConfig(targetActionType);
        // 更新数据库（通过动作校验后）
        const { error: updateError } = await supabase
            .from(planTable)
            .update({ training_days: updatedTrainingDays })
            .eq('id', templateId)
            .eq(planOwnerColumn, userId);

        if (updateError) {
            throw new Error('保存失败: ' + updateError.message);
        }

        return NextResponse.json({
            success: true,
            message: '修改已应用'
        });

    } catch (error: any) {
        console.error('[apply-batch-operation] Error:', error);
        return NextResponse.json(
            { success: false, message: error.message || '应用修改失败' },
            { status: 500 }
        );
    }
}
