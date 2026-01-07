import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    CreateKnowledgeBookDto,
    CreateKnowledgeBookResponseDto,
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

    // 检查用户是否为管理员
    if (!session.user.is_admin) {
        return NextResponse.json({
            success: false,
            message: "权限不足",
            data: null,
        }, { status: 403 });
    }

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
        // CreateKnowledgeBookResponseDto 反映的就是这个地方 data 的数据结构
        data: {
            book: data,
        },
    });
}
