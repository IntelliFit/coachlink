import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { WithdrawDto, WithdrawResponse } from "../entity";

const normalizePayeeType = (input?: string | null) => {
    if (!input) return "ALIPAY_LOGON_ID";
    if (input === "ALIPAY_LOGONID") return "ALIPAY_LOGON_ID";
    return input;
};

async function getCoachIdByUser(userId: string) {
    const { data: coach } = await supabase.from("coaches").select("id").eq("user_id", userId).single();
    return coach?.id || null;
}

/** 教练发起提现：发起即扣款，人工转账，48 小时内到账 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    const userId = session.user.id;
    const coachId = await getCoachIdByUser(userId);
    if (!coachId) return NextResponse.json({ success: false, message: "未找到教练信息", data: null }, { status: 404 });

    const body = await req.json() as WithdrawDto;
    const amount = Number(body?.amount || 0);
    if (!amount || amount <= 0) {
        return NextResponse.json({ success: false, message: "提现金额不合法", data: null }, { status: 400 });
    }
    if (amount < 0.1) {
        return NextResponse.json({ success: false, message: "单笔提现金额不能低于 0.10 元", data: null }, { status: 400 });
    }

    const { data: wallet } = await supabase.from("coach_wallets").select("balance, frozen_amount").eq("coach_id", coachId).single();
    const balance = Number(wallet?.balance || 0);
    if (balance < amount) {
        return NextResponse.json({ success: false, message: "余额不足", data: null }, { status: 400 });
    }

    const { data: account } = await supabase.from("alipay_accounts").select("id, payee_account, payee_type, real_name, verified").eq("coach_id", coachId).single();
    if (!account) {
        return NextResponse.json({ success: false, message: "未绑定支付宝账户，请先绑定", data: null }, { status: 400 });
    }

    const identityType = normalizePayeeType(account.payee_type);
    if (identityType === "ALIPAY_LOGON_ID" && !account.real_name) {
        return NextResponse.json({ success: false, message: "该支付宝账号缺少实名信息，请重新绑定并填写真实姓名", data: null }, { status: 400 });
    }

    const out_biz_no = `wd_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // 1) 创建提现记录（pending）
    const { data: withdrawal, error: werr } = await serviceRoleSupabase.from("alipay_withdrawals").insert({
        wallet_id: coachId,
        coach_id: coachId,
        amount,
        fee: 0,
        status: "pending",
        out_biz_no,
        created_at: now,
    }).select().single();

    if (werr || !withdrawal) {
        return NextResponse.json({ success: false, message: werr?.message || "创建提现记录失败", data: null }, { status: 500 });
    }

    // 2) 扣减余额并写入提现流水（发起即扣款，防止重复提现同一笔余额）
    try {
        await serviceRoleSupabase.from("coach_wallets").update({ balance: balance - amount, updated_at: now }).eq("coach_id", coachId);
        await serviceRoleSupabase.from("wallet_transactions").insert({
            wallet_id: coachId,
            amount: -Math.abs(amount),
            type: "withdrawal",
            description: `提现 ${amount.toFixed(2)}（待到账）`,
            related_withdrawal_id: withdrawal.id,
            created_at: now,
        });
    } catch (err) {
        console.error("[Withdraw] Deduct wallet failed", err);
        await serviceRoleSupabase.from("alipay_withdrawals").update({ status: "failed", processed_at: now }).eq("id", withdrawal.id);
        return NextResponse.json({ success: false, message: "钱包扣款失败", data: null }, { status: 500 });
    }

    return NextResponse.json<ApiData<WithdrawResponse>>({
        success: true,
        message: "提现申请已提交，预计 48 小时内到账",
        data: { id: withdrawal.id, status: "pending", out_biz_no },
    });
}

/** 单条提现详情（仅本人） */
export async function GET(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }
    const coachId = await getCoachIdByUser(session.user.id);
    if (!coachId) return NextResponse.json({ success: false, message: "未找到教练信息", data: null }, { status: 404 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
        // 列表：该教练所有提现记录
        const { data: rows, error } = await supabase
            .from("alipay_withdrawals")
            .select("id, amount, fee, status, out_biz_no, alipay_order_id, created_at, processed_at")
            .eq("coach_id", coachId)
            .order("created_at", { ascending: false })
            .limit(100);
        if (error) return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
        return NextResponse.json({ success: true, message: "提现记录", data: rows ?? [] });
    }

    const { data } = await supabase.from("alipay_withdrawals").select("*").eq("id", id).eq("coach_id", coachId).single();
    if (!data) return NextResponse.json({ success: false, message: "未找到记录", data: null }, { status: 404 });
    return NextResponse.json({ success: true, message: "提现记录", data });
}
