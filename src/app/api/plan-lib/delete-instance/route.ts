import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from '@/lib/supabaseClient';
import { DeleteInstanceDto, DeleteInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized"
        }, { status: 401 });
    }

    const { id } = await req.json() as DeleteInstanceDto;

    if (!id) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数"
        }, { status: 400 });
    }

    // 首先获取现有的计划实例以检查权限
    const { data: existingInstance, error: fetchError } = await supabase
        .from("coach_plan_instances")
        .select("id, coach_id, student_id")
        .eq("id", id)
        .single();

    if (fetchError || !existingInstance) {
        console.error("Error fetching instance:", fetchError);
        return NextResponse.json({
            success: false,
            message: "计划不存在"
        }, { status: 404 });
    }

    let hasPermission = false;

    if (existingInstance.student_id === userId) {
        hasPermission = true;
    } else if (existingInstance.coach_id && session.user.is_coach) {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", existingInstance.coach_id)
            .single();

        if (coachError) {
            console.error("Error checking coach permission:", coachError);
        }

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

    // 删除计划实例
    const { error } = await supabase
        .from("coach_plan_instances")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting instance:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to delete instance"
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<DeleteInstanceResponseDto>>({
        success: true,
        message: "删除训练计划实例成功",
        data: {
            success: true
        }
    });
}
