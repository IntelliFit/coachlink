import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { CanonicalAction } from "@/types/canonical";

/**
 * GET /api/canonical-actions/list
 * 获取公共动作库列表
 */
export async function GET(request: NextRequest) {
    try {
        // 获取查询参数
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const category = searchParams.get("category");

        let query = supabase
            .from("canonical_actions")
            .select("*")
            .order("name");

        // 按分类筛选
        if (category) {
            query = query.eq("category", category);
        }

        // 按名称搜索
        if (search) {
            query = query.ilike("name", `%${search}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching canonical actions:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            data: data as CanonicalAction[],
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json(
            { success: false, error: "服务器内部错误" },
            { status: 500 },
        );
    }
}
