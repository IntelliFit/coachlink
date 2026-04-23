import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import {
    getSubscriptionOrderMissingTableMessage,
    isSubscriptionOrderTableMissingError,
    markSubscriptionOrderSeen,
    submitSubscriptionOrderForConfirmation,
} from "@/lib/subscriptionOrders";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    UpdateSubscriptionOrderDto,
    UpdateSubscriptionOrderResponseDto,
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
        id,
        status,
        paymentMethod,
        note,
        paymentData,
        coachSeenAt,
    } = await req.json() as UpdateSubscriptionOrderDto;

    if (!id) {
        return NextResponse.json<ApiData<UpdateSubscriptionOrderResponseDto>>({
            success: false,
            message: "缺少订单ID",
            data: null,
        }, { status: 400 });
    }

    if (coachSeenAt) {
        try {
            const subscriptionOrder = await markSubscriptionOrderSeen(id, userId);
            return NextResponse.json<ApiData<UpdateSubscriptionOrderResponseDto>>({
                success: true,
                message: "已标记为已查看",
                data: { subscriptionOrder },
            });
        } catch (error) {
            const missingTable = isSubscriptionOrderTableMissingError(error);
            return NextResponse.json<ApiData<UpdateSubscriptionOrderResponseDto>>({
                success: false,
                message: missingTable
                    ? getSubscriptionOrderMissingTableMessage()
                    : error instanceof Error
                        ? error.message
                        : "更新失败",
                data: null,
            }, { status: missingTable ? 503 : 403 });
        }
    }

    if (status === "pending_confirmation") {
        try {
            const subscriptionOrder = await submitSubscriptionOrderForConfirmation({
                orderId: id,
                studentId: userId,
                paymentMethod: paymentMethod || "personal_qrcode",
                note: note ?? null,
                paymentData: paymentData ?? null,
            });

            return NextResponse.json<ApiData<UpdateSubscriptionOrderResponseDto>>({
                success: true,
                message: "已提交待教练确认",
                data: { subscriptionOrder },
            });
        } catch (error) {
            const missingTable = isSubscriptionOrderTableMissingError(error);
            return NextResponse.json<ApiData<UpdateSubscriptionOrderResponseDto>>({
                success: false,
                message: missingTable
                    ? getSubscriptionOrderMissingTableMessage()
                    : error instanceof Error
                        ? error.message
                        : "提交失败",
                data: null,
            }, { status: missingTable ? 503 : 400 });
        }
    }

    const { data: coach } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    const message = coach?.id ? "当前更新类型不受支持" : "无权更新该订阅订单";
    return NextResponse.json<ApiData<UpdateSubscriptionOrderResponseDto>>({
        success: false,
        message,
        data: null,
    }, { status: 400 });
}
