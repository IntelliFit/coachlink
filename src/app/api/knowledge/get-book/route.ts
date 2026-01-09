import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    GetKnowledgeBookDto,
    GetKnowledgeBookResponseDto,
} from "./entity";

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
    const { id } = await req.json() as GetKnowledgeBookDto;

    // 获取书籍信息
    const { data: book, error } = await supabase
        .from("knowledge_books")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
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

    if (!hasAccess && session.user) {
        // 检查用户是否订阅了知识库
        const { data: subscription, error: subError } = await supabase
            .from("knowledge_subscriptions")
            .select("*")
            .eq("user_id", userId)
            .eq("status", "active")
            .single();

        if (!subError && subscription) {
            hasAccess = true;
        }
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetKnowledgeBookResponseDto>>({
        success: true,
        message: "获取知识库书籍成功",
        // GetKnowledgeBookResponseDto 反映的就是这个地方 data 的数据结构
        data: {
            book: book,
            hasAccess: hasAccess,
        },
    });
}
