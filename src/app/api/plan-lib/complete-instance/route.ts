import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    CompleteInstanceDto,
    CompleteInstanceResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 完成计划实例
 *
 * 将指定计划的 status 设为 'completed'
 * 通常在学员完成计划最后一天训练时调用
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

    const { instanceId } = await req.json() as CompleteInstanceDto;

    if (!instanceId) {
        return NextResponse.json({
            success: false,
            message: "缺少 instanceId 参数",
        }, { status: 400 });
    }

    // 获取计划实例
    const { data: instance, error: fetchError } = await supabase
        .from("coach_plan_instances")
        .select("id, student_id, coach_id, status, name")
        .eq("id", instanceId)
        .single();

    if (fetchError || !instance) {
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

    // 更新状态
    const { data: updated, error: updateError } = await supabase
        .from("coach_plan_instances")
        .update({
            status: "completed",
            end_date: new Date().toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
        })
        .eq("id", instanceId)
        .select()
        .single();

    if (updateError) {
        console.error("Error completing instance:", updateError);
        return NextResponse.json({
            success: false,
            message: `完成计划失败: ${updateError.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<CompleteInstanceResponseDto>>({
        success: true,
        message: `恭喜！计划"${instance.name}"已完成`,
        data: {
            success: true,
            instance: updated,
        },
    });
}
