import { NextResponse } from "next/server";
import { getAuthUser } from '@/lib/auth';
import { isWechatFreeRequest } from '@/lib/wechatFreeRelease';
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    GetKnowledgeBookDto,
    GetKnowledgeBookResponseDto,
} from "./entity";
import { sanitizeBookRowForClient } from "../_helpers/bookSanitizer";

function getCollectionSlug(content: unknown) {
    if (!content || typeof content !== "object" || Array.isArray(content)) return null;
    const source = (content as { source?: unknown }).source;
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
    const slug = (source as { collectionSlug?: unknown }).collectionSlug;
    return typeof slug === "string" && slug.trim() ? slug.trim() : null;
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
    const userId = auth.userId;
    const { id } = await req.json() as GetKnowledgeBookDto;

    // 获取书籍信息
    let query = supabase
        .from("knowledge_books")
        .select("*")
        .eq("id", id);
    if (await isWechatFreeRequest(req) && !auth.user?.is_admin) query = query.eq('is_published', true);
    const { data: book, error } = await query.single();

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
    let hasAccess = Boolean(book.is_free || (book.is_published && await isWechatFreeRequest(req)));

    if (!hasAccess && auth.user) {
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

    const collectionSlug = getCollectionSlug(book.content);
    let collectionBooks: Record<string, unknown>[] = [];
    if (collectionSlug) {
        const { data: siblingRows, error: siblingError } = await supabase
            .from("knowledge_books")
            .select("*")
            .contains("content", { source: { collectionSlug } })
            .eq("is_published", true)
            .order("sort_order", { ascending: true });

        if (siblingError) {
            console.error("获取同书章节失败:", siblingError);
        } else {
            collectionBooks = (siblingRows || []).map((sibling) =>
                sanitizeBookRowForClient(sibling, { includeBody: false })
            );
        }
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetKnowledgeBookResponseDto>>({
        success: true,
        message: "获取知识库书籍成功",
        // GetKnowledgeBookResponseDto 反映的就是这个地方 data 的数据结构
        data: {
            book: sanitizeBookRowForClient(book, { includeBody: hasAccess }),
            hasAccess: hasAccess,
            collectionBooks,
        },
    });
}
