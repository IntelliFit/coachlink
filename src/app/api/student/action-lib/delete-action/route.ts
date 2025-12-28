import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    DeleteStudentActionDto,
    DeleteStudentActionResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const { id } = await req.json() as DeleteStudentActionDto;

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

    // 删除动作（确保只能删除自己的动作）
    const { error } = await supabase
        .from("student_actions")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

    if (error) {
        console.error("Error deleting student action:", error);
        return NextResponse.json({
            success: false,
            message: "删除动作失败",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<DeleteStudentActionResponseDto>>({
        success: true,
        message: "删除动作成功",
        data: {
            deleted: true,
        },
    });
}
