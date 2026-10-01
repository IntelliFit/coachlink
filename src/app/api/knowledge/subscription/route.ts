import { NextResponse } from "next/server";
import { rejectWechatPurchase } from '@/lib/wechatFreeRelease';
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    CreateKnowledgeSubscriptionDto,
    CreateKnowledgeSubscriptionResponseDto,
    GetKnowledgeSubscriptionResponseDto,
    UpdateKnowledgeSubscriptionDto,
} from "./entity";

export async function GET(req: Request) {
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

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetKnowledgeSubscriptionResponseDto>>({
        success: true,
        message: "获取知识库订阅成功",
        // GetKnowledgeSubscriptionResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            subscription: subscription || null,
        },
    });
}

export async function POST(req: Request) {
    const paused = rejectWechatPurchase(req);
    if (paused) return paused;
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
        order_id,
    } = await req.json() as CreateKnowledgeSubscriptionDto;

    // 检查用户是否已有订阅
    const { data: existingSubscription, error: existingError } = await supabase
        .from("knowledge_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();

    let subscription;
    let error;

    if (existingSubscription) {
        // 如果已有订阅，更新它
        const { data, error: updateError } = await supabase
            .from("knowledge_subscriptions")
            .update({
                plan,
                status: "active",
                order_id,
                started_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    .toISOString(), // 30天后过期
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .select()
            .single();

        subscription = data;
        error = updateError;
    } else {
        // 如果没有订阅，创建新订阅
        const { data, error: insertError } = await supabase
            .from("knowledge_subscriptions")
            .insert([{
                user_id: userId,
                plan,
                status: "active",
                order_id,
                started_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    .toISOString(), // 30天后过期
            }])
            .select()
            .single();

        subscription = data;
        error = insertError;
    }

    if (error) {
        console.error("创建/更新知识库订阅失败:", error);
        return NextResponse.json({
            success: false,
            message: "创建/更新知识库订阅失败",
            data: null,
        }, { status: 500 });
    }

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<CreateKnowledgeSubscriptionResponseDto>>({
        success: true,
        message: "知识库订阅创建/更新成功",
        // CreateKnowledgeSubscriptionResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            subscription: subscription,
        },
    });
}

// PUT route for updating a subscription
export async function PUT(req: Request) {
    const paused = rejectWechatPurchase(req);
    if (paused) return paused;
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

    // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<CreateKnowledgeSubscriptionResponseDto>>({
        success: true,
        message: "知识库订阅更新成功",
        // CreateKnowledgeSubscriptionResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            subscription: data,
        },
    });
}
