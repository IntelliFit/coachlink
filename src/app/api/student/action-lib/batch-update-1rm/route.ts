import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";

interface BatchUpdate1RMDto {
    updates: Array<{
        actionId: string;
        reference_1rm: number | null;
    }>;
}

export async function POST(req: Request) {
    const { updates } = await req.json() as BatchUpdate1RMDto;

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({
            success: false,
            message: "缺少更新数据",
        }, { status: 400 });
    }

    // 提取所有动作ID
    const actionIds = updates.map(u => u.actionId).filter(Boolean);
    if (actionIds.length === 0) {
        return NextResponse.json({
            success: false,
            message: "动作ID列表为空",
        }, { status: 400 });
    }

    // 查询这些动作，确保它们属于当前用户且符合1RM资格
    const { data: existingActions, error: fetchError } = await supabase
        .from("student_actions")
        .select("id, type, attrs, \"enableAutoWeightCompute\", reference_1rm")
        .in("id", actionIds)
        .eq("user_id", userId);

    if (fetchError) {
        console.error("Error fetching actions:", fetchError);
        return NextResponse.json({
            success: false,
            message: "查询动作失败",
        }, { status: 500 });
    }

    if (!existingActions || existingActions.length === 0) {
        return NextResponse.json({
            success: false,
            message: "未找到符合条件的动作",
        }, { status: 404 });
    }

    // 构建更新映射，只更新符合条件的动作
    const actionMap = new Map(existingActions.map(a => [a.id, a]));
    const validUpdates: Array<{ id: string; reference_1rm: number | null }> = [];

    for (const update of updates) {
        const action = actionMap.get(update.actionId);
        if (!action) continue;

        // 检查动作是否符合1RM资格
        const eligible = isOneRMEligibleAction({
            type: action.type as string | undefined,
            attrs: (action.attrs as string[] | null) || undefined,
            enableAutoWeightCompute: (action as any).enableAutoWeightCompute as boolean | undefined,
        });

        if (!eligible) {
            // 非资格动作，强制置空
            validUpdates.push({
                id: update.actionId,
                reference_1rm: null,
            });
        } else {
            // 资格动作，验证1RM值
            const value = update.reference_1rm;
            if (value !== null && (!Number.isFinite(value) || value <= 0)) {
                // 无效值，置空
                validUpdates.push({
                    id: update.actionId,
                    reference_1rm: null,
                });
            } else {
                validUpdates.push({
                    id: update.actionId,
                    reference_1rm: value,
                });
            }
        }
    }

    if (validUpdates.length === 0) {
        return NextResponse.json({
            success: false,
            message: "没有有效的更新项",
        }, { status: 400 });
    }

    // 批量更新
    const updatePromises = validUpdates.map(update =>
        supabase
            .from("student_actions")
            .update({
                reference_1rm: update.reference_1rm,
                updated_at: new Date().toISOString(),
            })
            .eq("id", update.id)
            .eq("user_id", userId)
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
        console.error("Error updating actions:", errors);
        return NextResponse.json({
            success: false,
            message: `部分更新失败：${errors.length}/${validUpdates.length}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<{ updated: number }>>({
        success: true,
        message: "批量更新1RM成功",
        data: {
            updated: validUpdates.length,
        },
    });
}

