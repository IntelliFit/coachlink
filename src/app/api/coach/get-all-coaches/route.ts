import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { GetAllCoachesDto } from "./entity";

export async function POST(req: Request) {
    const {
        page = 1,
        limit = 10,
        search = '',
        specialty = 'all'
    } = await req.json() as GetAllCoachesDto;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 构建查询
    let query = supabase
        .from("coaches")
        .select("*", { count: "exact" })
        .eq("status", "approved");

    // 搜索
    if (search.trim()) {
        // 使用 ilike 做模糊匹配（简单方案）：
        query = query.or(
            `name.ilike.%${search}%,title.ilike.%${search}%,bio.ilike.%${search}%`
        );
    }

    // specialty 数组过滤
    if (specialty.trim() && specialty.trim() !== 'all') {
        query = query.contains("specialties", [specialty]);
    }

    // 排序和分页
    query = query
        .order("rating", { ascending: false })
        .range(from, to);

    const { data: coaches, error, count } = await query;

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
            coaches,
            count,
            pagination: { page, limit }
        }
    });
}
