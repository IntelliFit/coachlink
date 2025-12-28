import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    UpdateStudentActionDto,
    UpdateStudentActionResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const { id, ...updateData } = await req.json() as UpdateStudentActionDto;

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    if (!id) {
        return NextResponse.json({
            success: false,
            message: "缺少动作ID",
        }, { status: 400 });
    }

    // 更新动作（确保只能更新自己的动作）
    const { data: action, error } = await supabase
        .from("student_actions")
        .update({
            ...updateData,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) {
        console.error("Error updating student action:", error);
        return NextResponse.json({
            success: false,
            message: "更新动作失败",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<UpdateStudentActionResponseDto>>({
        success: true,
        message: "更新动作成功",
        data: {
            action,
        },
    });
}
