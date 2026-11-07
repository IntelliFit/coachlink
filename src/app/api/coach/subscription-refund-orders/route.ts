import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { classifyCoachRefundOrders, COACH_SUBSCRIPTION_ORDER_TYPES, type RefundOrderRow } from "@/lib/coachRefundOrders";
import type { ApiData } from "@/types/api";
import type { CoachRefundOrdersResponseDto, CoachRefundOrdersDto } from "./entity";

export const runtime = "nodejs";

function fail(message: string, status: number) {
    return NextResponse.json<ApiData<CoachRefundOrdersResponseDto>>({ success: false, message, data: null }, { status });
}

/**
 * The paid orders of one of the coach's subscriptions that the coach can refund,
 * with each order's role and whether refunding it cancels the subscription.
 * Identity comes from the session; the subscription must belong to this coach.
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id;
    if (!userId) return fail("用户未登录", 401);

    let body: CoachRefundOrdersDto;
    try {
        body = (await req.json()) as CoachRefundOrdersDto;
    } catch {
        return fail("请求格式错误", 400);
    }
    const subscriptionId = String(body?.subscriptionId || "").trim();
    if (!subscriptionId) return fail("缺少订阅ID", 400);

    const { data: coach, error: coachError } = await serviceRoleSupabase
        .from("coaches")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
    if (coachError) {
        console.error("[coach/subscription-refund-orders] read coach failed", coachError);
        return fail("读取教练信息失败", 500);
    }
    if (!coach?.id) return fail("未找到教练身份", 403);

    const { data: subscription, error: subscriptionError } = await serviceRoleSupabase
        .from("coach_subscriptions")
        .select("id, coach_id, student_id, status, order_id, last_payment_order_id")
        .eq("id", subscriptionId)
        .maybeSingle();
    if (subscriptionError) {
        console.error("[coach/subscription-refund-orders] read subscription failed", subscriptionError);
        return fail("读取订阅失败", 500);
    }
    if (!subscription || subscription.coach_id !== coach.id) return fail("无权查看该订阅", 403);

    const orderColumns = "id, status, total_amount, order_type, payment_provider, created_at, order_data";
    const appliedId = String(subscription.last_payment_order_id || "").trim();
    const [paidRes, appliedRes, subscriptionOrdersRes] = await Promise.all([
        (serviceRoleSupabase.from("alipay_orders") as any)
            .select(orderColumns)
            .eq("user_id", subscription.student_id)
            .eq("status", "paid")
            .in("order_type", [...COACH_SUBSCRIPTION_ORDER_TYPES])
            .order("created_at", { ascending: false })
            .limit(50),
        // Whatever its status, the applied order's type decides whether a duplicate refund cancels.
        appliedId
            ? (serviceRoleSupabase.from("alipay_orders") as any).select(orderColumns).eq("id", appliedId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        // Web checkouts link their payment orders through coach_subscription_orders.
        serviceRoleSupabase.from("coach_subscription_orders" as any)
            .select("id")
            .eq("subscription_id", subscription.id)
            .limit(100),
    ]);
    const readError = paidRes.error || appliedRes.error || subscriptionOrdersRes.error;
    if (readError) {
        console.error("[coach/subscription-refund-orders] read orders failed", readError);
        return fail("读取订单失败", 500);
    }
    const paidOrders = (paidRes.data || []) as RefundOrderRow[];
    const applied = appliedRes.data as RefundOrderRow | null;
    const orders = applied && !paidOrders.some((order) => order.id === applied.id) ? [...paidOrders, applied] : paidOrders;
    const subscriptionOrderIds = ((subscriptionOrdersRes.data || []) as unknown as Array<{ id: string }>).map((row) => String(row.id));

    const refundable = classifyCoachRefundOrders({
        coachId: coach.id,
        subscription,
        orders,
        subscriptionOrderIds,
    });
    return NextResponse.json<ApiData<CoachRefundOrdersResponseDto>>({
        success: true,
        message: "ok",
        data: { orders: refundable },
    });
}
