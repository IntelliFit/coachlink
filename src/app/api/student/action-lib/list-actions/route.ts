import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    ListStudentActionsDto,
    ListStudentActionsResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const {
        page = 1,
        limit = 12,
        search,
    } = await req.json() as ListStudentActionsDto;

    console.log(
        `[API] list-actions params: page=${page}, limit=${limit}, search=${search}`,
    );

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    // 构建查询
    let query = supabase
        .from("student_actions")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    // 应用搜索过滤
    if (search) {
        // 转义特殊字符，确保搜索安全
        const escapedSearch = search.replace(/[%_]/g, "\\$&");
        query = query.or(
            `name.ilike.%${escapedSearch}%,detail.ilike.%${escapedSearch}%`,
        );
    }

    // 应用分页
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: actions, count, error } = await query;

    console.log(
        `[API] list-actions result: count=${count}, fetched=${actions?.length}`,
    );

    if (error) {
        console.error("Error fetching student actions:", error);
        return NextResponse.json({
            success: false,
            message: "获取动作列表失败",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ListStudentActionsResponseDto>>({
        success: true,
        message: "获取动作列表成功",
        data: {
            actions: actions || [],
            totalCount: count || 0,
            page,
            limit,
        },
    });
}
