import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { GetFavoriteDto, GetFavoriteResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const { id } = await req.json() as GetFavoriteDto;

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
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

    if (error) {
        console.error("Error fetching favorite:", error);
        return NextResponse.json({
            success: false,
            message: `获取常用计划失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<GetFavoriteResponseDto>>({
        success: true,
        message: "获取常用计划成功",
        data: {
            favorite,
        },
    });
}
