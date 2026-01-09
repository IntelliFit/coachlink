import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    UpdateKnowledgeSubscriptionDto,
    UpdateKnowledgeSubscriptionResponseDto,
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
        plan,
        status,
    } = await req.json() as UpdateKnowledgeSubscriptionDto;

    // 更新订阅
    const { data, error } = await supabase
        .from("knowledge_subscriptions")
        .update({
            plan,
            status,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();

    if (error) {
        console.error("更新知识库订阅失败:", error);
        return NextResponse.json({
            success: false,
            message: "更新知识库订阅失败",
            data: null,
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数の接口类型>
    return NextResponse.json<ApiData<UpdateKnowledgeSubscriptionResponseDto>>({
        success: true,
        message: "知识库订阅更新成功",
        // UpdateKnowledgeSubscriptionResponseDto 反映的就是这个地方 data のデータ構造
        data: {
            subscription: data,
        },
    });
}
