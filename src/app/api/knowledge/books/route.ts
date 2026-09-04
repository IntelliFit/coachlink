import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { getAuthUser } from "@/lib/auth";
import { sanitizeBookRowForClient } from "../_helpers/bookSanitizer";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    GetKnowledgeBooksDto,
    GetKnowledgeBooksResponseDto,
    GetKnowledgeBookByIdDto,
    GetKnowledgeBookByIdResponseDto,
    CreateKnowledgeBookDto,
    CreateKnowledgeBookResponseDto,
    UpdateKnowledgeBookDto,
    UpdateKnowledgeBookResponseDto,
} from "./entity";

export async function GET(req: Request) {
    const auth = await getAuthUser(req);
    if (!auth.isAuthenticated || !auth.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 解析查询参数
    const url = new URL(req.url);
    const is_free = url.searchParams.get("is_free");
    const is_published = url.searchParams.get("is_published");

    // 构建查询
    let query = supabase
        .from("knowledge_books")
        .select("*")
        .order("sort_order", { ascending: true });

    if (is_free !== null) {
        query = query.eq("is_free", is_free === "true");
    }

    if (is_published !== null) {
        query = query.eq("is_published", is_published === "true");
    } else if (!auth.user?.is_admin) {
        query = query.eq("is_published", true);
    }

    const { data, error } = await query;

    if (error) {
        console.error("获取知识库书籍失败:", error);
        return NextResponse.json({
            success: false,
            message: "获取知识库书籍失败",
            data: null,
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetKnowledgeBooksResponseDto>>({
        success: true,
        message: "获取知识库书籍成功",
        // GetKnowledgeBooksResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            books: (data || []).map((book) =>
                sanitizeBookRowForClient(book, { includeBody: false })
            ),
            total: data?.length || 0,
        },
    });
}

export async function POST(req: Request) {
    const auth = await getAuthUser(req);
    if (!auth.isAuthenticated || !auth.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;

    const {
        title,
        author,
        cover_image,
        summary,
        audio_url,
        content,
        is_free,
        is_published,
        sort_order,
    } = await req.json() as CreateKnowledgeBookDto;

    // 插入新书籍
    const { data, error } = await supabase
        .from("knowledge_books")
        .insert([{
            title,
            author,
            cover_image,
            summary,
            audio_url,
            content,
            is_free: is_free || false,
            is_published: is_published || false,
            sort_order: sort_order || 0,
        }])
        .select()
        .single();

    if (error) {
        console.error("创建知识库书籍失败:", error);
        return NextResponse.json({
            success: false,
            message: "创建知识库书籍失败",
            data: null,
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<CreateKnowledgeBookResponseDto>>({
        success: true,
        message: "知识库书籍创建成功",
        // CreateKnowledgeBookResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            book: data,
        },
    });
}

// PUT route for updating a book
export async function PUT(req: Request) {
    const auth = await getAuthUser(req);
    if (!auth.isAuthenticated || !auth.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;

    // 检查用户是否为管理员
    if (!session.user.is_admin) {
        return NextResponse.json({
            success: false,
            message: "权限不足",
            data: null,
        }, { status: 403 });
    }

    const {
        id,
        title,
        author,
        cover_image,
        summary,
        audio_url,
        content,
        is_free,
        is_published,
        sort_order,
    } = await req.json() as UpdateKnowledgeBookDto;

    // 更新书籍
    const { data, error } = await supabase
        .from("knowledge_books")
        .update({
            title,
            author,
            cover_image,
            summary,
            audio_url,
            content,
            is_free,
            is_published,
            sort_order,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("更新知识库书籍失败:", error);
        return NextResponse.json({
            success: false,
            message: "更新知识库书籍失败",
            data: null,
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdateKnowledgeBookResponseDto>>({
        success: true,
        message: "知识库书籍更新成功",
        // UpdateKnowledgeBookResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            book: data,
        },
    });
}
