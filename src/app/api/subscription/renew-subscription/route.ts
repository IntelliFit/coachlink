import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    RenewSubscriptionDto,
    RenewSubscriptionResponseDto,
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
        subscriptionId,
        renewType,
        additionalWeeks,
        amount,
        orderId,
    } = await req.json() as RenewSubscriptionDto;

    // 参数验证
    if (!subscriptionId || !additionalWeeks || additionalWeeks <= 0) {
        return NextResponse.json<ApiData<RenewSubscriptionResponseDto>>({
            success: false,
            message: "缺少必要参数或参数无效",
            data: null,
        }, { status: 400 });
    }

    // 获取订阅信息
    const { data: subscription, error: subError } = await supabase
        .from("coach_subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .single();

    if (subError || !subscription) {
        return NextResponse.json<ApiData<RenewSubscriptionResponseDto>>({
            success: false,
            message: "订阅不存在",
            data: null,
        }, { status: 404 });
    }

    // 验证权限（必须是订阅的学员）
    if (subscription.student_id !== userId) {
        return NextResponse.json<ApiData<RenewSubscriptionResponseDto>>({
            success: false,
            message: "无权操作此订阅",
            data: null,
        }, { status: 403 });
    }

    // 计算新的结束日期
    // 如果当前有 end_date 且未过期，在其基础上延长
    // 否则从今天开始计算
    const now = new Date();
    let baseDate = now;

    if (subscription.end_date) {
        const currentEndDate = new Date(subscription.end_date);
        if (currentEndDate > now) {
            baseDate = currentEndDate;
        }
    }

    const newEndDate = new Date(baseDate);
    newEndDate.setDate(newEndDate.getDate() + (additionalWeeks * 7));

    // 更新订阅
    const { data: updatedSubscription, error: updateError } = await supabase
        .from("coach_subscriptions")
        .update({
            end_date: newEndDate.toISOString(),
            status: "active", // 续费后确保状态为活跃
            updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .select()
        .single();

    if (updateError || !updatedSubscription) {
        console.error("续费失败:", updateError);
        return NextResponse.json<ApiData<RenewSubscriptionResponseDto>>({
            success: false,
            message: "续费失败",
            data: null,
        }, { status: 500 });
    }

    // TODO: 记录续费订单信息（可后续扩展）

    return NextResponse.json<ApiData<RenewSubscriptionResponseDto>>({
        success: true,
        message: `续费成功，新到期日期：${
            newEndDate.toLocaleDateString("zh-CN")
        }`,
        data: {
            subscription: updatedSubscription,
        },
    });
}
