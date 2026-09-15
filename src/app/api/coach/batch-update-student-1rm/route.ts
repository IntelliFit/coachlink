import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";

interface BatchUpdateStudent1RMDto {
    subscriptionId: string;
    updates: Array<{
        actionId: string;
        reference_1rm: number | null;
    }>;
}

export async function POST(req: Request) {
    const { subscriptionId, updates } = await req.json() as BatchUpdateStudent1RMDto;

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    if (!subscriptionId || !Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数",
        }, { status: 400 });
    }

    // 验证教练权限
    const { data: subscription, error: subError } = await supabase
        .from("coach_subscriptions")
        .select("coach_id, student_id, coaches(user_id)")
        .eq("id", subscriptionId)
        .single();

    if (subError || !subscription) {
        return NextResponse.json({
            success: false,
            message: "订阅不存在",
        }, { status: 404 });
    }

    const coachInfo = subscription.coaches as any;
    if (coachInfo?.user_id !== userId) {
        return NextResponse.json({
            success: false,
            message: "无权限访问",
        }, { status: 403 });
    }

    const studentId = subscription.student_id as string | null;
    if (!studentId) {
        return NextResponse.json({
            success: false,
            message: "学员ID不存在",
        }, { status: 400 });
    }

    // 同一动作只保留请求中的最后一个值，并限制单次请求规模。
    const requestedUpdateByActionId = new Map<string, number | null>();
    for (const update of updates.slice(0, 200)) {
        const actionId = String(update?.actionId || "").trim();
        if (!actionId) continue;
        requestedUpdateByActionId.set(actionId, update.reference_1rm);
    }
    const actionIds = Array.from(requestedUpdateByActionId.keys());
    if (actionIds.length === 0) {
        return NextResponse.json({
            success: false,
            message: "动作ID列表为空",
        }, { status: 400 });
    }

    // 查询这些动作，确保它们属于学员且符合1RM资格
    const { data: existingActions, error: fetchError } = await supabase
        .from("student_actions")
        .select("id, type, attrs, \"enableAutoWeightCompute\", reference_1rm")
        .in("id", actionIds)
        .eq("user_id", studentId);

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

    for (const [actionId, requestedValue] of requestedUpdateByActionId) {
        const action = actionMap.get(actionId);
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
                id: actionId,
                reference_1rm: null,
            });
        } else {
            // 资格动作，验证1RM值
            const value = requestedValue;
            if (value !== null && (!Number.isFinite(value) || value <= 0)) {
                // 无效值，置空
                validUpdates.push({
                    id: actionId,
                    reference_1rm: null,
                });
            } else {
                validUpdates.push({
                    id: actionId,
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

    // 单次 RPC 在一个 SQL statement 内完成所有写入，避免每个动作各发一次 PATCH。
    const { data: updatedActions, error: updateError } = await (supabase as any).rpc(
        "batch_update_student_action_reference_1rm",
        {
            p_student_id: studentId,
            p_updates: validUpdates,
        },
    );

    if (updateError) {
        console.error("Error updating actions:", updateError);
        return NextResponse.json({
            success: false,
            message: "批量更新失败",
        }, { status: 500 });
    }

    const updatedRows = Array.isArray(updatedActions) ? updatedActions : [];
    if (updatedRows.length !== validUpdates.length) {
        console.error("Unexpected 1RM update count:", {
            expected: validUpdates.length,
            actual: updatedRows.length,
        });
        return NextResponse.json({
            success: false,
            message: "部分动作未能更新，请刷新后重试",
        }, { status: 409 });
    }

    return NextResponse.json<ApiData<{ updated: number; actions: any[] }>>({
        success: true,
        message: "批量更新1RM成功",
        data: {
            updated: updatedRows.length,
            actions: updatedRows,
        },
    });
}

