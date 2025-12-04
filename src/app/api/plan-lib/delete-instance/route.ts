import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { DeleteInstanceDto, DeleteInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const { id } = await req.json() as DeleteInstanceDto;

    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized"
        }, { status: 401 });
    }

    if (!id) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数"
        }, { status: 400 });
    }

    // 首先获取现有的计划实例以检查权限
    const { data: existingInstance, error: fetchError } = await supabase
        .from("coach_plan_instances")
        .select("coach_id, student_id")
        .eq("id", id)
        .single();

    if (fetchError) {
        console.error("Error fetching instance:", fetchError);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch instance"
        }, { status: 500 });
    }

    // 检查用户权限（只有教练或学员本人可以删除）
    if (existingInstance.coach_id !== userId && existingInstance.student_id !== userId) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
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