import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { fenToYuan, formatYuanFromFen } from "@/lib/moneyUtils";

export const dynamic = "force-dynamic";

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session?.user?.id) return { ok: false as const, status: 401, message: "未登录" };
    if (!(session.user as { is_admin?: boolean })?.is_admin) return { ok: false as const, status: 403, message: "无权限" };
    return { ok: true as const };
}

/** 管理员：确认已人工转账，填写转账订单号后完成（不再扣款，发起时已扣） */
export async function POST(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.message, data: null }, { status: auth.status });

    const body = await req.json() as { id?: string; alipay_order_id?: string };
    const id = body?.id;
    const alipayOrderId = (body?.alipay_order_id ?? "").trim();

    if (!id) return NextResponse.json({ success: false, message: "缺少提现ID", data: null }, { status: 400 });
    if (!alipayOrderId) return NextResponse.json({ success: false, message: "请填写转账订单号", data: null }, { status: 400 });

    const { data: withdrawal, error: fetchErr } = await serviceRoleSupabase
        .from("alipay_withdrawals")
        .select("id, coach_id, amount, status")
        .eq("id", id)
        .single();

    if (fetchErr || !withdrawal) {
        return NextResponse.json({ success: false, message: fetchErr?.message ?? "未找到该提现记录", data: null }, { status: 404 });
    }
    if (withdrawal.status !== "pending") {
        return NextResponse.json({ success: false, message: "该提现已处理，无法重复确认", data: null }, { status: 400 });
    }

    const now = new Date().toISOString();
    const confirmedByUserId = session!.user!.id;

    const { error: updateErr } = await serviceRoleSupabase
        .from("alipay_withdrawals")
        .update({
            status: "success",
            alipay_order_id: alipayOrderId,
            confirmed_by_user_id: confirmedByUserId,
            alipay_response: {
                manual_confirmed_at: now,
                alipay_order_id: alipayOrderId,
            },
            processed_at: now,
        })
        .eq("id", id);

    if (updateErr) return NextResponse.json({ success: false, message: updateErr.message ?? "更新失败", data: null }, { status: 500 });

    // 更新教练端钱包流水描述为「已到账」，方便账单显示
    // 数据库存储的是分（整数）
    const amountFen = Number((withdrawal as { amount?: number }).amount ?? 0);
    const amountYuanStr = formatYuanFromFen(amountFen);
    await serviceRoleSupabase
        .from("wallet_transactions")
        .update({ description: `提现 ${amountYuanStr}（已到账）` })
        .eq("related_withdrawal_id", id);

    return NextResponse.json<ApiData<{ id: string }>>({
        success: true,
        message: "已确认到账",
        data: { id: withdrawal.id },
    });
}
