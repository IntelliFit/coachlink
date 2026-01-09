import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    GetKnowledgeSubscriptionDto,
    GetKnowledgeSubscriptionResponseDto,
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

    // 获取用户知识库订阅信息
    const { data: subscription, error } = await supabase
        .from("knowledge_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (error && error.code !== "PGRST116") { // PGRST116 means no rows found
        console.error("获取知识库订阅失败:", error);
        return NextResponse.json({
            success: false,
            message: "获取知识库订阅失败",
            data: null,
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数の接口类型>
    return NextResponse.json<ApiData<GetKnowledgeSubscriptionResponseDto>>({
        success: true,
        message: "获取知识库订阅成功",
        // GetKnowledgeSubscriptionResponseDto 反映的就是这个地方 data のデータ構造
        data: {
            subscription: subscription || null,
        },
    });
}
