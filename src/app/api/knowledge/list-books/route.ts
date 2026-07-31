import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    ListKnowledgeBooksDto,
    ListKnowledgeBooksResponseDto,
} from "./entity";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import { sanitizeBookRowForClient } from "../_helpers/bookSanitizer";

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
        limit = 200
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
    const safeLimit = Math.min(Math.max(limit || 200, 1), 1000);
    if (page !== undefined) {
        query = query.range(page * safeLimit, (page + 1) * safeLimit - 1);
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
            // 列表只返回分组所需的 source 元数据，避免把每章全文和本机路径批量下发。
            books: (data || []).map((book) =>
                sanitizeBookRowForClient(book, { includeBody: false })
            ),
            total: count || 0,
            page,
            limit: safeLimit,
        },
    });
}
