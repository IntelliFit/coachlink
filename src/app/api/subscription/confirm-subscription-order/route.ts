import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import {
    confirmSubscriptionOrderByCoach,
    getSubscriptionOrderMissingTableMessage,
    isSubscriptionOrderTableMissingError,
} from "@/lib/subscriptionOrders";
import type { ApiData } from "@/types/api";
import type {
    ConfirmSubscriptionOrderDto,
    ConfirmSubscriptionOrderResponseDto,
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

    const { orderId } = await req.json() as ConfirmSubscriptionOrderDto;
    if (!orderId) {
        return NextResponse.json<ApiData<ConfirmSubscriptionOrderResponseDto>>({
            success: false,
            message: "缺少订单ID",
            data: null,
        }, { status: 400 });
    }

    try {
        const result = await confirmSubscriptionOrderByCoach(orderId, session.user.id);
        return NextResponse.json<ApiData<ConfirmSubscriptionOrderResponseDto>>({
            success: true,
            message: "订阅订单已确认",
            data: {
                subscriptionOrder: result.order,
                subscription: result.subscription,
            },
        });
    } catch (error) {
        const missingTable = isSubscriptionOrderTableMissingError(error);
        return NextResponse.json<ApiData<ConfirmSubscriptionOrderResponseDto>>({
            success: false,
            message: missingTable
                ? getSubscriptionOrderMissingTableMessage()
                : error instanceof Error
                    ? error.message
                    : "确认失败",
            data: null,
        }, { status: missingTable ? 503 : 400 });
    }
}
