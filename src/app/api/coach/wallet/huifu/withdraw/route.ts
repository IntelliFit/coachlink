import { NextRequest, NextResponse } from "next/server";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { formatYuan, formatYuanFromFen, subtractFen, yuanToFen } from "@/lib/moneyUtils";
import { encashmentForCoach, formatHuifuReqDate, generateReqSeqId } from "@/lib/huifuMiniProgramPay";
import { calculateRefundProtectedAmountFen, getWithdrawableWalletAmounts } from "@/lib/coachWalletLock";
import { getApiUserId } from "@/lib/getApiUserId";
import { getCoachWithdrawalRules } from "@/lib/coachWithdrawalRules";

async function getCoachIdByUser(userId: string) {
    const { data: coach } = await supabase.from("coaches").select("id").eq("user_id", userId).single();
    return coach?.id || null;
}

/** Coach withdrawal through Huifu encashment to the bound settlement card. */
export async function POST(req: NextRequest) {
    const userId = await getApiUserId(req);
    if (!userId) {
        return NextResponse.json<ApiData<null>>({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    const coachId = await getCoachIdByUser(userId);
    if (!coachId) {
        return NextResponse.json<ApiData<null>>({ success: false, message: "未找到教练信息", data: null }, { status: 404 });
    }

    const body = (await req.json()) as { amount?: number };
    const amountYuan = Number(body?.amount || 0);
    if (!amountYuan || amountYuan <= 0) {
        return NextResponse.json<ApiData<null>>({ success: false, message: "提现金额不合法", data: null }, { status: 400 });
    }
    const amountFen = yuanToFen(amountYuan);

    const { data: coach } = await supabase
        .from("coaches")
        .select("huifu_id, huifu_open_status, huifu_card_token")
        .eq("id", coachId)
        .single();

    if (!coach) {
        return NextResponse.json<ApiData<null>>({ success: false, message: "未找到教练信息", data: null }, { status: 404 });
    }

    if (coach.huifu_open_status !== "opened" || !coach.huifu_id) {
        return NextResponse.json<ApiData<null>>({ success: false, message: "尚未开通汇付收款账户", data: null }, { status: 400 });
    }

    if (!coach.huifu_card_token) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "未绑定结算银行卡，请重新开通汇付账户",
            data: null,
        }, { status: 400 });
    }

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
    const withdrawalRules = getCoachWithdrawalRules(walletAmounts.withdrawableFen);

    if (amountFen < yuanToFen(withdrawalRules.min_amount)) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: `单笔提现金额不能低于 ${withdrawalRules.min_amount.toFixed(2)} 元`,
            data: null,
        }, { status: 400 });
    }

    if (walletAmounts.withdrawableFen < amountFen) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: `可提现余额不足，7天内可退款收入会暂时冻结。当前可提现：${formatYuanFromFen(walletAmounts.withdrawableFen)}`,
            data: null,
        }, { status: 400 });
    }

    const now = new Date().toISOString();
    let encashResult;
    const huifuReqDate = formatHuifuReqDate();
    const huifuReqSeqId = generateReqSeqId();

    try {
        encashResult = await encashmentForCoach({
            reqDate: huifuReqDate,
            reqSeqId: huifuReqSeqId,
            cashAmtYuan: formatYuan(amountYuan),
            huifuId: coach.huifu_id,
            tokenNo: coach.huifu_card_token,
            intoAcctDateType: withdrawalRules.arrival_type,
        });
    } catch (error: any) {
        console.error("[Huifu Withdraw] encashment call failed:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: `提现请求失败: ${error?.message || "未知错误"}`,
            data: null,
        }, { status: 500 });
    }

    if (encashResult.resp_code !== "00000000" && encashResult.resp_code !== "00000100") {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: encashResult.resp_desc || "提现失败",
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
            description: `提现 ${formatYuanFromFen(amountFen)}（汇付到银行卡）`,
            huifu_req_date: huifuReqDate,
            huifu_req_seq_id: huifuReqSeqId,
            huifu_hf_seq_id: encashResult.hf_seq_id || null,
            huifu_trans_stat: encashResult.trans_stat || null,
            huifu_error_message: encashResult.resp_desc || null,
            created_at: now,
        });
    } catch (error: any) {
        console.error("[Huifu Withdraw] deduct wallet failed:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "钱包扣款失败，但提现已发起，请联系客服",
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<{ hfSeqId?: string }>>({
        success: true,
        message: `提现申请已提交，${withdrawalRules.arrival_description}`,
        data: { hfSeqId: encashResult.hf_seq_id },
    });
}
