import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import { sanitizeBookRowForClient } from "../../_helpers/bookSanitizer";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type { GetKnowledgeBookByIdResponseDto } from "../entity";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getAuthUser(req);
    if (!auth.isAuthenticated || !auth.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = auth.userId;
    const { id: bookId } = await params;

    // 获取书籍信息
    let bookQuery = supabase
        .from("knowledge_books")
        .select("*")
        .eq("id", bookId);

    if (!auth.user?.is_admin) {
        bookQuery = bookQuery.eq("is_published", true);
    }

    const { data: book, error } = await bookQuery.single();

    if (error && error.code !== "PGRST116") {
        console.error("获取知识库书籍失败:", error);
        return NextResponse.json({
            success: false,
            message: "获取知识库书籍失败",
            data: null,
        }, { status: 500 });
    }

    if (!book) {
        return NextResponse.json({
            success: false,
            message: "书籍不存在",
            data: null,
        }, { status: 404 });
    }

    // 检查用户是否有访问权限
    let hasAccess = book.is_free; // 免费内容直接有权限

    if (!hasAccess) {
        // 检查用户是否订阅了知识库
        const { data: subscription, error: subError } = await supabase
            .from("knowledge_subscriptions")
            .select("*")
            .eq("user_id", userId)
            .eq("status", "active")
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .single();

        if (!subError && subscription) {
            hasAccess = true;
        }
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetKnowledgeBookByIdResponseDto>>({
        success: true,
        message: "获取知识库书籍成功",
        // GetKnowledgeBookByIdResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            book: {
                ...sanitizeBookRowForClient(book, { includeBody: hasAccess }),
                audio_url: hasAccess ? book.audio_url : null,
            },
            hasAccess: hasAccess,
        },
    });
}
