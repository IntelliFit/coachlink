import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { UpdateFavoriteDto, UpdateFavoriteResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const { id, ...updateData } = await req.json() as UpdateFavoriteDto;

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
            message: "缺少计划ID",
        }, { status: 400 });
    }

    const { data: favorite, error } = await supabase
        .from("student_plan_favorites")
        .update({
            ...updateData,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) {
        console.error("Error updating favorite:", error);
        return NextResponse.json({
            success: false,
            message: `更新常用计划失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<UpdateFavoriteResponseDto>>({
        success: true,
        message: "更新常用计划成功",
        data: {
            favorite,
        },
    });
}
