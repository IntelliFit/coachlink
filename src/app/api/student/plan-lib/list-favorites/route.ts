import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ListFavoritesDto, ListFavoritesResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const { page = 1, limit = 12 } = await req.json() as ListFavoritesDto;

    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: favorites, count, error } = await supabase
        .from("student_plan_favorites")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Error fetching favorites:", error);
        return NextResponse.json({
            success: false,
            message: `获取常用计划失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ListFavoritesResponseDto>>({
        success: true,
        message: "获取常用计划成功",
        data: {
            favorites: favorites || [],
            totalCount: count || 0,
            page,
            limit,
        },
    });
}
