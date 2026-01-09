import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    ListKnowledgeSubscriptionsDto,
    ListKnowledgeSubscriptionsResponseDto,
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
    const {
        user_id,
        status,
        page = 0,
        limit = 20,
    } = await req.json() as ListKnowledgeSubscriptionsDto;

    // 构建查询
    let query = supabase
        .from("knowledge_subscriptions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

    // 如果是管理员，可以查询所有用户的订阅；否则只查询自己的
    if (session.user.is_admin && user_id) {
        query = query.eq("user_id", user_id);
    } else {
        query = query.eq("user_id", userId);
    }

    if (status) {
        query = query.eq("status", status);
    }

    // 分页
    if (page !== undefined && limit !== undefined) {
        query = query.range(page * limit, (page + 1) * limit - 1);
    }

    const { data, count, error } = await query;

    if (error) {
        console.error("获取知识库订阅列表失败:", error);
        return NextResponse.json({
            success: false,
            message: "获取知识库订阅列表失败",
            data: null,
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数の接口类型>
    return NextResponse.json<ApiData<ListKnowledgeSubscriptionsResponseDto>>({
        success: true,
        message: "获取知识库订阅列表成功",
        // ListKnowledgeSubscriptionsResponseDto 反映的就是这个地方 data のデータ構造
        data: {
            subscriptions: data || [],
            total: count || 0,
            page,
            limit,
        },
    });
}
