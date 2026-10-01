import { NextResponse } from "next/server";
import { rejectWechatPurchase } from '@/lib/wechatFreeRelease';
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    RenewSubscriptionDto,
    RenewSubscriptionResponseDto,
} from "./entity";
import { onRenewalPaid } from "@/lib/coachingAutomation";
import { refreshSubscriptionEntitlementSnapshot } from "@/lib/subscriptionEntitlementSnapshot";

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

    // B1: 续费只增加“购买范围 weeks”（用于计算训练日 credits 范围），
    // end_date 只是预计完成日，会在训练完成/订阅列表接口里动态刷新，不在这里直接叠加天数。
    const newSubscribedWeeks = Number(subscription.subscribed_weeks || 0) + Number(additionalWeeks || 0);

    // 更新订阅
    const { data: updatedSubscription, error: updateError } = await supabase
        .from("coach_subscriptions")
        .update({
            subscribed_weeks: newSubscribedWeeks,
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

    const entitlementModel = await refreshSubscriptionEntitlementSnapshot(subscriptionId);

    try {
        await onRenewalPaid(subscriptionId);
    } catch (automationError) {
        console.warn("[renew-subscription] renewal automation failed:", automationError);
    }

    // TODO: 记录续费订单信息（可后续扩展）

    return NextResponse.json<ApiData<RenewSubscriptionResponseDto>>({
        success: true,
        message: `续费成功，已增加 ${additionalWeeks} 周（按训练日次数消耗）`,
        data: {
            subscription: entitlementModel?.displayEndDate
                ? { ...updatedSubscription, end_date: entitlementModel.displayEndDate }
                : updatedSubscription,
        },
    });
}
