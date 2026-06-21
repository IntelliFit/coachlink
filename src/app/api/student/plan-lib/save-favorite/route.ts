import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { SaveFavoriteDto, SaveFavoriteResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
    const favoriteData = await req.json() as SaveFavoriteDto;

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

    if (!favoriteData.name) {
        return NextResponse.json({
            success: false,
            message: "请输入计划名称",
        }, { status: 400 });
    }

    if (!favoriteData.training_days) {
        return NextResponse.json({
            success: false,
            message: "训练日数据不能为空",
        }, { status: 400 });
    }

    const { data: favorite, error } = await supabase
        .from("student_plan_favorites")
        .insert({
            user_id: userId,
            name: favoriteData.name,
            description: favoriteData.description || null,
            training_days: favoriteData.training_days,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error("Error saving favorite:", error);
        return NextResponse.json({
            success: false,
            message: `保存常用计划失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<SaveFavoriteResponseDto>>({
        success: true,
        message: "保存常用计划成功",
        data: {
            favorite,
        },
    });
}
