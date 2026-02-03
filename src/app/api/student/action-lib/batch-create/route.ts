import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import {
    BatchCreateStudentActionsDto,
    BatchCreateStudentActionsResponseDto,
} from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { normalizeActionNameForMatch } from "@/lib/planImportText";
import type { ItemType } from "@/types/student";

/**
 * 批量创建学员动作
 * 用于智能导入时快速创建多个新动作
 */
export async function POST(req: Request) {
    const { actions } = await req.json() as BatchCreateStudentActionsDto;

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!actions || actions.length === 0) {
        return NextResponse.json({
            success: false,
            message: "请提供要创建的动作列表",
        }, { status: 400 });
    }

    try {
        // 防重复：如果动作名称已经存在于学员动作库，则跳过创建
        const { data: existing, error: existingError } = await serviceRoleSupabase
            .from("student_actions")
            .select("id,name")
            .eq("user_id", userId);

        if (existingError) {
            console.error("Error fetching existing student actions:", existingError);
            return NextResponse.json({
                success: false,
                message: "获取动作库失败: " + existingError.message,
            }, { status: 500 });
        }

        const existingNameSet = new Set<string>(
            (existing || []).map((a: any) => normalizeActionNameForMatch(a.name)),
        );

        const uniqueToCreate = actions.filter((a) => {
            const key = normalizeActionNameForMatch(a.name);
            return key && !existingNameSet.has(key);
        });

        // 批量插入学员动作（学员动作表不包含自动计算相关字段）
        const defaultAttrsByType: Record<ItemType, string[]> = {
            STRENGTH: ["组数", "次数", "强度", "休息时间"],
            CARDIO: ["距离", "配速", "持续时间"],
            DIET: ["食物清单", "热量", "宏量营养"],
            HABIT: ["目标数值", "完成状态"],
        };

        const actionsToInsert = uniqueToCreate.map((action) => {
            const itemType = normalizeItemType((action as any).type);
            const attrs = (action as any).attrs?.length
                ? (action as any).attrs
                : defaultAttrsByType[itemType];
            return {
                user_id: userId,
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
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
        });

        const createdActions: any[] = [];
        if (actionsToInsert.length > 0) {
            const { data, error } = await serviceRoleSupabase
                .from("student_actions")
                .insert(actionsToInsert)
                .select();

            if (error) {
                console.error("Error creating student actions:", error);
                return NextResponse.json({
                    success: false,
                    message: "创建动作失败: " + error.message,
                }, { status: 500 });
            }
            createdActions.push(...(data || []));
        }

        const skipped = actions.length - uniqueToCreate.length;

        return NextResponse.json<ApiData<BatchCreateStudentActionsResponseDto>>(
            {
                success: true,
                message: `成功创建 ${createdActions?.length || 0} 个动作${
                    skipped > 0 ? `（已跳过 ${skipped} 个同名重复动作）` : ""
                }`,
                data: {
                    createdActions: createdActions || [],
                },
            },
        );
    } catch (error) {
        console.error("Error batch creating student actions:", error);
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
