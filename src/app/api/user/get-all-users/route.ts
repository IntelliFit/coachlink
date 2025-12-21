import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { GetAllUsersDto } from "./entity";

export async function POST(req: Request) {
    const {
        page = 1,
        limit = 10,
        search = ''
    } = await req.json() as GetAllUsersDto;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 构建查询
    let query = supabase
        .from("user_profiles")
        .select("*", { count: "exact" });

    // 搜索
    if (search.trim()) {
        // 使用 ilike 做模糊匹配
        query = query.ilike("nickname", `%${search}%`);
    }

    // 排序和分页
    query = query
        .order("created_at", { ascending: false })
        .range(from, to);

    const { data: users, error, count } = await query;

    if (error) {
        return NextResponse.json({
            success: false,
            message: error.message
        });
    }

    return NextResponse.json({
        success: true,
        message: "获取成功",
        data: {
            users: users || [],
            count: count || 0,
            pagination: { page, limit }
        }
    });
}