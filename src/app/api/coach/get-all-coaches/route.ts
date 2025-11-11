import supabase from "@/lib/supabaseClient";
import { NextResponse } from 'next/server';
import { GetAllCoachesDto } from "./entity";

export async function POST(req: Request) {
    // 解析请求 body
    const body = await req.json() as GetAllCoachesDto;
    const page = body.page ?? 1;     // 默认第 1 页
    const limit = body.limit ?? 10;  // 默认每页 10 条
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 查询 Supabase
    const { data: coaches, error, count } = await supabase
        .from("coaches")
        .select("*", { count: "exact" })
        .eq("status", "approved")
        .order("rating", { ascending: false })
        .range(from, to);

    if (error) {
        return NextResponse.json({
            success: false,
            message: error.message
        });
    }

    return NextResponse.json({
        success: true,
        message: '获取成功',
        data: {
            coaches,
            count,
            pagination: {
                page,
                limit
            }
        }
    });
}
