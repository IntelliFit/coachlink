import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    ListKnowledgeBooksDto,
    ListKnowledgeBooksResponseDto,
} from "./entity";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;
    const {
        is_free,
        is_published,
        page = 0,
        limit = 20
    } = await req.json() as ListKnowledgeBooksDto;

    // 构建查询
    let query = supabase
        .from("knowledge_books")
        .select("*", { count: "exact" })
        .order("sort_order", { ascending: true });

    if (is_free !== undefined) {
        query = query.eq("is_free", is_free);
    }

    if (is_published !== undefined) {
        query = query.eq("is_published", is_published);
    }

    // 分页
    if (page !== undefined && limit !== undefined) {
        query = query.range(page * limit, (page + 1) * limit - 1);
    }

    const { data, count, error } = await query;

    if (error) {
        console.error("获取知识库书籍列表失败:", error);
        return NextResponse.json({
            success: false,
            message: "获取知识库书籍列表失败",
            data: null,
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<ListKnowledgeBooksResponseDto>>({
        success: true,
        message: "获取知识库书籍列表成功",
        // ListKnowledgeBooksResponseDto 反映的就是这个地方 data 的数据结构
        data: {
            books: data || [],
            total: count || 0,
            page,
            limit,
        },
    });
}
