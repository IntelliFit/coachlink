import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { WithdrawDto, WithdrawResponse } from "../entity";
import { fenToYuan, formatYuanFromFen, subtractFen, yuanToFen } from "@/lib/moneyUtils";
import { calculateRefundProtectedAmountFen, getWithdrawableWalletAmounts } from "@/lib/coachWalletLock";
import { getNoticeUserName, notifyPlatformOwners } from "@/lib/platformNotice";

const normalizePayeeType = (input?: string | null) => {
    if (!input) return "ALIPAY_LOGON_ID";
    if (input === "ALIPAY_LOGONID") return "ALIPAY_LOGON_ID";
    return input;
};

async function getCoachIdByUser(userId: string) {
    const { data: coach } = await supabase.from("coaches").select("id").eq("user_id", userId).single();
    return coach?.id || null;
}

/** Coach withdrawal through the legacy manual Alipay payout flow. */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    const coachId = await getCoachIdByUser(session.user.id);
    if (!coachId) {
        return NextResponse.json({ success: false, message: "未找到教练信息", data: null }, { status: 404 });
    }

    const body = (await req.json()) as WithdrawDto;
    const amountYuan = Number(body?.amount || 0);
    if (!amountYuan || amountYuan <= 0) {
        return NextResponse.json({ success: false, message: "提现金额不合法", data: null }, { status: 400 });
    }
    if (amountYuan < 0.1) {
        return NextResponse.json({ success: false, message: "单笔提现金额不能低于 0.10 元", data: null }, { status: 400 });
    }

    const amountFen = yuanToFen(amountYuan);
    const { data: wallet } = await supabase
        .from("coach_wallets")
        .select("balance, frozen_amount")
        .eq("coach_id", coachId)
        .single();

    const refundProtectedFen = await calculateRefundProtectedAmountFen(coachId);
    const walletAmounts = getWithdrawableWalletAmounts({
        balanceFen: Number(wallet?.balance ?? 0),
        storedFrozenFen: Number(wallet?.frozen_amount ?? 0),
        refundProtectedFen,
    });

    if (walletAmounts.withdrawableFen < amountFen) {
        return NextResponse.json({
            success: false,
            message: `可提现余额不足，7天内可退款收入会暂时冻结。当前可提现：${formatYuanFromFen(walletAmounts.withdrawableFen)}`,
            data: null,
        }, { status: 400 });
    }

    const { data: account } = await supabase
        .from("alipay_accounts")
        .select("id, payee_account, payee_type, real_name, verified")
        .eq("coach_id", coachId)
        .single();

    if (!account) {
        return NextResponse.json({ success: false, message: "未绑定支付宝账户，请先绑定", data: null }, { status: 400 });
    }

    const identityType = normalizePayeeType(account.payee_type);
    if (identityType === "ALIPAY_LOGON_ID" && !account.real_name) {
        return NextResponse.json({
            success: false,
            message: "该支付宝账号缺少实名信息，请重新绑定并填写真实姓名",
            data: null,
        }, { status: 400 });
    }

    const outBizNo = `wd_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const { data: withdrawal, error: withdrawalError } = await serviceRoleSupabase
        .from("alipay_withdrawals")
        .insert({
            wallet_id: coachId,
            coach_id: coachId,
            amount: amountFen,
            fee: 0,
            status: "pending",
            out_biz_no: outBizNo,
            created_at: now,
        })
        .select()
        .single();

    if (withdrawalError || !withdrawal) {
        return NextResponse.json({
            success: false,
            message: withdrawalError?.message || "创建提现记录失败",
            data: null,
        }, { status: 500 });
    }

    try {
        const newBalanceFen = subtractFen(walletAmounts.balanceFen, amountFen);
        await serviceRoleSupabase
            .from("coach_wallets")
            .update({ balance: newBalanceFen, updated_at: now })
            .eq("coach_id", coachId);

        await serviceRoleSupabase.from("wallet_transactions").insert({
            wallet_id: coachId,
            amount: -amountFen,
            type: "withdrawal",
            description: `提现 ${formatYuanFromFen(amountFen)}（待到账）`,
            related_withdrawal_id: withdrawal.id,
            created_at: now,
        });
    } catch (error) {
        console.error("[Withdraw] Deduct wallet failed", error);
        await serviceRoleSupabase
            .from("alipay_withdrawals")
            .update({ status: "failed", processed_at: now })
            .eq("id", withdrawal.id);
        return NextResponse.json({ success: false, message: "钱包扣款失败", data: null }, { status: 500 });
    }

    await notifyPlatformOwners({
        kind: "withdrawal_pending",
        title: "教练提现申请待打款（支付宝）",
        fields: [
            ["教练", await getNoticeUserName(session.user.id)],
            ["金额", formatYuanFromFen(amountFen)],
        ],
        adminPath: "/admin/withdrawals",
    });

    return NextResponse.json<ApiData<WithdrawResponse>>({
        success: true,
        message: "提现申请已提交，预计 48 小时内到账",
        data: { id: withdrawal.id, status: "pending", out_biz_no: outBizNo },
    });
}

/** Withdrawal detail/list for the current coach. */
export async function GET(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    const coachId = await getCoachIdByUser(session.user.id);
    if (!coachId) {
        return NextResponse.json({ success: false, message: "未找到教练信息", data: null }, { status: 404 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
        const { data: rows, error } = await supabase
            .from("alipay_withdrawals")
            .select("id, amount, fee, status, out_biz_no, alipay_order_id, created_at, processed_at")
            .eq("coach_id", coachId)
            .order("created_at", { ascending: false })
            .limit(100);

        if (error) {
            return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
        }

        const convertedRows = (rows ?? []).map((row) => ({
            ...row,
            amount: fenToYuan(row.amount ?? 0),
            fee: fenToYuan(row.fee ?? 0),
        }));

        return NextResponse.json({ success: true, message: "提现记录", data: convertedRows });
    }

    const { data } = await supabase
        .from("alipay_withdrawals")
        .select("*")
        .eq("id", id)
        .eq("coach_id", coachId)
        .single();

    if (!data) {
        return NextResponse.json({ success: false, message: "未找到记录", data: null }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "提现记录", data });
}
