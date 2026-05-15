import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import {
    getSubscriptionOrderMissingTableMessage,
    isSubscriptionOrderTableMissingError,
    upsertSubscriptionOrder,
} from "@/lib/subscriptionOrders";
import supabase from "@/lib/supabaseClient";
import {
    durationMonthsFromPurchasedWeeks,
    resolveCoachSubscriptionPricing,
} from "@/lib/coachSubscriptionPricing";
import type { ApiData } from "@/types/api";
import type {
    CreateSubscriptionOrderDto,
    CreateSubscriptionOrderResponseDto,
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

    const userId = session.user.id;
    const {
        coachId,
        orderType,
        subscriptionId,
        subscribeData,
        productId,
        subscribedWeeks,
    } = await req.json() as CreateSubscriptionOrderDto;

    if (!coachId || !orderType) {
        return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
            success: false,
            message: "缺少必要参数",
            data: null,
        }, { status: 400 });
    }

    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id, status")
        .eq("id", coachId)
        .single();

    if (coachError || !coach || coach.status !== "approved") {
        return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
            success: false,
            message: "指定教练不存在或未获批准",
            data: null,
        }, { status: 400 });
    }

    let renewalSubscriptionProductId: string | null = null;

    if (orderType === "renew") {
        if (!subscriptionId) {
            return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
                success: false,
                message: "续费订单缺少订阅ID",
                data: null,
            }, { status: 400 });
        }

        const { data: subscription, error: subscriptionError } = await supabase
            .from("coach_subscriptions")
            .select("id, student_id, coach_id, status, product_id")
            .eq("id", subscriptionId)
            .single();

        if (subscriptionError || !subscription) {
            return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
                success: false,
                message: "订阅不存在",
                data: null,
            }, { status: 404 });
        }

        if (subscription.student_id !== userId || subscription.coach_id !== coachId) {
            return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
                success: false,
                message: "无权为该订阅创建续费订单",
                data: null,
            }, { status: 403 });
        }

        if (!["active", "expired", "near_expiry"].includes(String(subscription.status || ""))) {
            return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
                success: false,
                message: "当前订阅状态不支持续费",
                data: null,
            }, { status: 400 });
        }

        renewalSubscriptionProductId = String(subscription.product_id || "").trim() || null;
        if (!renewalSubscriptionProductId) {
            return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
                success: false,
                message: "当前订阅缺少套餐信息，请重新选择套餐",
                data: null,
            }, { status: 400 });
        }

        if (productId && productId !== renewalSubscriptionProductId) {
            return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
                success: false,
                message: "续费只能延长当前套餐，请重新选择",
                data: null,
            }, { status: 400 });
        }
    } else {
        const { data: activeSub } = await supabase
            .from("coach_subscriptions")
            .select("id")
            .eq("coach_id", coachId)
            .eq("student_id", userId)
            .eq("status", "active")
            .maybeSingle();

        if (activeSub?.id) {
            return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
                success: false,
                message: "您已订阅该教练，请直接走续费流程",
                data: null,
            }, { status: 409 });
        }
    }

    let pricing;
    try {
        pricing = await resolveCoachSubscriptionPricing({
            coachId,
            productId: orderType === "renew"
                ? renewalSubscriptionProductId
                : productId,
            durationMonths: durationMonthsFromPurchasedWeeks(subscribedWeeks),
        });
    } catch (error) {
        return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
            success: false,
            message: error instanceof Error ? error.message : "套餐价格校验失败，请重新选择套餐",
            data: null,
        }, { status: 400 });
    }

    try {
        const subscriptionOrder = await upsertSubscriptionOrder({
            studentId: userId,
            coachId,
            orderType,
            subscriptionId: subscriptionId || null,
            tier: pricing.tier,
            amountFen: pricing.amountFen,
            productId: pricing.productId,
            productName: pricing.productName,
            productTier: pricing.productTier,
            purchasedWeeks: pricing.purchasedWeeks,
            subscribeData: subscribeData ?? null,
        });

        return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
            success: true,
            message: "订阅订单已创建",
            data: {
                subscriptionOrder,
            },
        });
    } catch (error) {
        const missingTable = isSubscriptionOrderTableMissingError(error);
        return NextResponse.json<ApiData<CreateSubscriptionOrderResponseDto>>({
            success: false,
            message: missingTable
                ? getSubscriptionOrderMissingTableMessage()
                : error instanceof Error
                    ? error.message
                    : "创建订阅订单失败",
            data: null,
        }, { status: missingTable ? 503 : 500 });
    }
}
