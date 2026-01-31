import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    ActivateInstanceDto,
    ActivateInstanceResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 激活计划实例（带冲突检测）
 *
 * 逻辑：
 * 1. 检查当前是否有 active 计划
 * 2. 若有，根据进度决定设为 completed 或 archived
 * 3. 将指定计划设为 active
 *
 * 权限：学员本人或教练
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    const { instanceId, archiveCurrentIfExists = true } = await req
        .json() as ActivateInstanceDto;

    if (!instanceId) {
        return NextResponse.json({
            success: false,
            message: "缺少 instanceId 参数",
        }, { status: 400 });
    }

    // 获取要激活的计划
    const { data: targetInstance, error: fetchError } = await supabase
        .from("coach_plan_instances")
        .select("id, student_id, coach_id, status, name")
        .eq("id", instanceId)
        .single();

    if (fetchError || !targetInstance) {
        return NextResponse.json({
            success: false,
            message: "计划不存在",
        }, { status: 404 });
    }

    const studentId = targetInstance.student_id;

    // 权限检查：学员本人或教练
    let hasPermission = false;

    if (studentId === userId) {
        hasPermission = true;
    } else if (targetInstance.coach_id && session.user.is_coach) {
        const { data: coach } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", targetInstance.coach_id)
            .single();

        if (coach?.user_id === userId) {
            hasPermission = true;
        }
    }

    if (!hasPermission) {
        return NextResponse.json({
            success: false,
            message: "权限不足",
        }, { status: 403 });
    }

    let previousInstanceInfo: { id: string; newStatus: string } | undefined;

    // 检查当前是否有 active 计划
    if (archiveCurrentIfExists) {
        const { data: currentActive } = await supabase
            .from("coach_plan_instances")
            .select("id, training_days")
            .eq("student_id", studentId)
            .eq("status", "active")
            .neq("id", instanceId) // 排除要激活的计划本身
            .maybeSingle();

        if (currentActive) {
            // 简单判断进度：如果没有执行记录，设为 archived；否则设为 completed
            // 更精确的进度计算需要关联 plan_instance_executions
            const { count: executionCount } = await supabase
                .from("plan_instance_executions")
                .select("id", { count: "exact", head: true })
                // plan_instance_executions uses `instance_id`
                .eq("instance_id", currentActive.id);

            const newStatus = (executionCount && executionCount > 0)
                ? "archived"
                : "archived";

            await supabase
                .from("coach_plan_instances")
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", currentActive.id);

            previousInstanceInfo = {
                id: currentActive.id,
                newStatus,
            };
        }
    }

    // 激活目标计划
    const { data: activated, error: activateError } = await supabase
        .from("coach_plan_instances")
        .update({
            status: "active",
            start_date:
                targetInstance.status === "draft" ||
                    targetInstance.status === "scheduled"
                    ? new Date().toISOString().split("T")[0]
                    : undefined,
            updated_at: new Date().toISOString(),
        })
        .eq("id", instanceId)
        .select()
        .single();

    if (activateError) {
        console.error("Error activating instance:", activateError);
        return NextResponse.json({
            success: false,
            message: `激活失败: ${activateError.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ActivateInstanceResponseDto>>({
        success: true,
        message: previousInstanceInfo
            ? `已归档旧计划并激活"${targetInstance.name}"`
            : `已激活"${targetInstance.name}"`,
        data: {
            success: true,
            newActiveInstance: activated,
            previousInstance: previousInstanceInfo,
        },
    });
}
