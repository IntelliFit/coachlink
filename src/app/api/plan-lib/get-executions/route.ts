import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { GetExecutionsDto, GetExecutionsResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 获取计划实例的执行记录
 *
 * 返回指定计划下所有 plan_instance_executions 记录
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

    const { instanceId } = await req.json() as GetExecutionsDto;

    if (!instanceId) {
        return NextResponse.json({
            success: false,
            message: "缺少 instanceId 参数",
        }, { status: 400 });
    }

    // 验证用户权限
    const { data: instance } = await supabase
        .from("coach_plan_instances")
        .select("id, student_id, coach_id")
        .eq("id", instanceId)
        .single();

    if (!instance) {
        return NextResponse.json({
            success: false,
            message: "计划不存在",
        }, { status: 404 });
    }

    // 权限检查：学员本人或教练
    let hasPermission = false;

    if (instance.student_id === userId) {
        hasPermission = true;
    } else if (instance.coach_id && session.user.is_coach) {
        const { data: coach } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", instance.coach_id)
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

    // 获取执行记录
    const { data: executions, error } = await supabase
        .from("plan_instance_executions")
        .select("*")
        .eq("instance_id", instanceId)
        .order("day_index", { ascending: true });

    if (error) {
        console.error("Error fetching executions:", error);
        return NextResponse.json({
            success: false,
            message: `获取执行记录失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<GetExecutionsResponseDto>>({
        success: true,
        message: "获取执行记录成功",
        data: {
            executions: executions || [],
        },
    });
}
