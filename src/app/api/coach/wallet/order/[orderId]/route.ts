import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import { fenToYuan } from "@/lib/moneyUtils";

export interface CoachOrderDetail {
    id: string;
    subject: string | null;
    total_amount: number;
    status: string;
    order_type: string | null;
    alipay_trade_no: string | null;
    created_at: string;
    updated_at: string;
    user_nickname?: string | null;
    user_full_name?: string | null;
}

/** 教练查看与自己钱包关联的订单详情（仅限 order_data.coachId 为当前教练的订单） */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const session = await getServerSession();
    const authUser = session?.user?.id ? { userId: session.user.id } : await getAuthUser(_req);

    if (!authUser.userId) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    const { orderId } = await params;
    if (!orderId?.trim()) {
        return NextResponse.json({ success: false, message: "缺少订单ID", data: null }, { status: 400 });
    }

    const { data: coach } = await supabase.from("coaches").select("id").eq("user_id", session.user.id).single();
    if (!coach) {
        return NextResponse.json({ success: false, message: "未找到教练信息", data: null }, { status: 404 });
    }

    const { data: order, error: orderErr } = await serviceRoleSupabase
        .from("alipay_orders")
        .select("id, user_id, subject, total_amount, status, order_type, order_data, alipay_trade_no, created_at, updated_at")
        .eq("id", orderId.trim())
        .single();

    if (orderErr || !order) {
        return NextResponse.json({ success: false, message: "订单不存在", data: null }, { status: 404 });
    }

    const orderData = (order.order_data ?? {}) as Record<string, unknown>;
    const orderCoachId = orderData?.coachId as string | undefined;
    if (orderCoachId !== coach.id) {
        return NextResponse.json({ success: false, message: "无权查看该订单", data: null }, { status: 403 });
    }

    let user_nickname: string | null = null;
    let user_full_name: string | null = null;
    if (order.user_id) {
        const { data: profile } = await serviceRoleSupabase
            .from("user_profiles")
            .select("nickname, full_name")
            .eq("user_id", order.user_id)
            .single();
        if (profile) {
            user_nickname = profile.nickname ?? null;
            user_full_name = profile.full_name ?? null;
        }
    }

    const result: CoachOrderDetail = {
        id: order.id,
        subject: order.subject ?? null,
        total_amount: fenToYuan(Number(order.total_amount ?? 0)),
        status: order.status,
        order_type: order.order_type ?? null,
        alipay_trade_no: order.alipay_trade_no ?? null,
        created_at: order.created_at,
        updated_at: order.updated_at,
        user_nickname,
        user_full_name,
    };

    return NextResponse.json<ApiData<CoachOrderDetail>>({
        success: true,
        message: "ok",
        data: result,
    });
}
