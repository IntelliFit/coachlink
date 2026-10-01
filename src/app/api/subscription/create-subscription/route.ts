import { NextRequest, NextResponse } from "next/server";
import { rejectWechatPurchase } from '@/lib/wechatFreeRelease';
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import { yuanToFen } from "@/lib/moneyUtils";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    CreateSubscriptionDto,
    CreateSubscriptionResponseDto,
} from "./entity";
import { Json } from "@/types/database.types";

export async function POST(req: NextRequest) {
    const paused = rejectWechatPurchase(req);
    if (paused) return paused;
    const userId = await getApiUserId(req);
    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const {
        coachId,
        tier,
        orderId,
        monthlyPrice,
        status = "active",
        subscribeData,
        // 新增产品字段
        productId,
        productName,
        productTier,
        subscribedWeeks,
    } = await req.json() as CreateSubscriptionDto;

    // 参数验证
    if (!coachId || !tier || monthlyPrice === undefined) {
        return NextResponse.json<ApiData<CreateSubscriptionResponseDto>>({
            success: false,
            message: "缺少必要参数",
            data: null,
        }, { status: 400 });
    }

    // 检查教练是否存在且已获批准
    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id")
        .eq("id", coachId)
        .eq("status", "approved")
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<CreateSubscriptionResponseDto>>({
            success: false,
            message: "指定的教练不存在或未获批准",
            data: null,
        }, { status: 400 });
    }

    // 查看是否已经存在订阅
    const { data: subscriptionQuery, error: subscriptionQueryError } =
        await supabase
            .from("coach_subscriptions")
            .select("id")
            .eq("coach_id", coachId)
            .eq("student_id", userId)
            .maybeSingle();

    if (subscriptionQueryError) {
        return NextResponse.json({
            success: false,
            message: subscriptionQueryError.message,
            data: null,
        }, { status: 500 });
    }

    if (subscriptionQuery) {
        const { data: existingSubscription, error: existingSubscriptionError } =
            await supabase
                .from("coach_subscriptions")
                .select("*")
                .eq("id", subscriptionQuery.id)
                .single();

        if (existingSubscriptionError || !existingSubscription) {
            return NextResponse.json({
                success: false,
                message: existingSubscriptionError?.message || "订阅记录读取失败",
                data: null,
            }, { status: 500 });
        }

        // 已生效订阅不在这里重写价格/周期；续费走专门的续费与支付确认链路。
        if (existingSubscription.status === "active") {
            return NextResponse.json({
                success: true,
                message: "训练计划已经创建",
                data: {
                    subscription: existingSubscription,
                },
            });
        }

        // 更新现有订阅的数据
        const updateData: Record<string, unknown> = {
            tier,
            monthly_price: yuanToFen(monthlyPrice),
            status,
            subscribe_data: subscribeData as unknown as Json,
        };

        // 如果提供了产品信息，也更新产品字段
        if (productId) updateData.product_id = productId;
        if (productName) updateData.product_name = productName;
        if (productTier) updateData.product_tier = productTier;
        if (orderId) updateData.order_id = orderId;
        // NOTE: do NOT recompute end_date here. Duration changes/renewals should be handled by
        // payment callbacks or dedicated renewal/admin flows to avoid "reset from now" bugs.
        if (subscribedWeeks) updateData.subscribed_weeks = subscribedWeeks;

        const { data: subscriptionEdit, error: subscriptionEditError } =
            await supabase
                .from("coach_subscriptions")
                .update(updateData)
                .eq("id", subscriptionQuery.id)
                .select()
                .maybeSingle();

        return NextResponse.json({
            success: true,
            message: "训练计划已经创建",
            data: {
                subscription: subscriptionEdit || subscriptionQuery,
            },
        });
    }

    // NOTE (B1): 对外售卖“4周计划”，对内按“训练日次数(credits)”消耗。
    // 有效期从学员第一次实际开始训练（产生第一条 execution）那天开始算，所以创建订阅时不写 start_date / end_date。

    // 构建插入数据（前端传元，DB 存分）
    const insertData: Record<string, unknown> = {
        student_id: userId,
        coach_id: coachId,
        tier: tier,
        monthly_price: yuanToFen(monthlyPrice),
        status,
        subscribe_data: subscribeData as unknown as Json,
        start_date: null,
        end_date: null,
    };

    // 添加产品字段（如果提供）
    if (productId) insertData.product_id = productId;
    if (productName) insertData.product_name = productName;
    if (productTier) insertData.product_tier = productTier;
    if (subscribedWeeks) insertData.subscribed_weeks = subscribedWeeks;

    // 创建订阅记录
    const { data: subscription, error: subscriptionError } = await supabase
        .from("coach_subscriptions")
        .insert(insertData as any)
        .select()
        .single();

    if (subscriptionError || !subscription) {
        console.error(subscriptionError);

        return NextResponse.json<ApiData<CreateSubscriptionResponseDto>>({
            success: false,
            message: "创建订阅失败",
            data: null,
        }, { status: 500 });
    }

    // 异步触发自动匹配计划（后台任务，不阻塞响应）
    // 如果匹配失败，静默处理，教练可以手动创建计划
    if (subscription.status === "active" && subscribeData) {
        // 获取教练ID（需要从coachId转换为coaches表的id）
        const { data: coach } = await supabase
            .from("coaches")
            .select("id, user_id")
            .eq("id", coachId)
            .single();

        if (coach?.id) {
            // 异步执行，不等待结果
            import("@/app/api/plan-lib/auto-match-plan/service").then(({ autoMatchPlanForSubscription }) => {
                autoMatchPlanForSubscription(
                    subscription.id,
                    userId, // actorUserId
                    coach.id, // actorCoachId
                ).catch((err) => {
                    // 静默处理错误，只记录日志
                    console.error("[create-subscription] 自动匹配计划失败（已静默处理）:", err);
                });
            }).catch((err) => {
                console.error("[create-subscription] 加载自动匹配模块失败:", err);
            });
        }
    }

    // 重要！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<CreateSubscriptionResponseDto>>({
        success: true,
        message: "订阅成功",
        // CreateSubscriptionResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            subscription,
        },
    });
}
