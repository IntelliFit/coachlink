import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { DeleteFavoriteDto, DeleteFavoriteResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
    const { id } = await req.json() as DeleteFavoriteDto;

    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    const userId = authResult.userId || null;

    if (!authResult.isAuthenticated || !userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    if (!id) {
        return NextResponse.json({
            success: false,
            message: "缺少计划ID",
        }, { status: 400 });
    }

    const { error } = await supabase
        .from("student_plan_favorites")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

    if (error) {
        console.error("Error deleting favorite:", error);
        return NextResponse.json({
            success: false,
            message: `删除常用计划失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<DeleteFavoriteResponseDto>>({
        success: true,
        message: "删除常用计划成功",
        data: {
            deleted: true,
        },
    });
}
