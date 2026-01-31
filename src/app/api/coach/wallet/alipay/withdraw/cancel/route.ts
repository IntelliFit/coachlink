import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { addFen, formatYuanFromFen } from "@/lib/moneyUtils";

async function getCoachIdByUser(userId: string) {
    const { data: coach } = await supabase.from("coaches").select("id").eq("user_id", userId).single();
    return coach?.id || null;
}

/** 教练撤回提现：仅允许撤回 pending 状态的提现，退回余额 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    const userId = session.user.id;
    const coachId = await getCoachIdByUser(userId);
    if (!coachId) return NextResponse.json({ success: false, message: "未找到教练信息", data: null }, { status: 404 });

    const body = await req.json() as { id?: string };
    const withdrawalId = body?.id;
    if (!withdrawalId) {
        return NextResponse.json({ success: false, message: "缺少提现ID", data: null }, { status: 400 });
    }

    // 查询提现记录
    const { data: withdrawal, error: fetchErr } = await supabase
        .from("alipay_withdrawals")
        .select("id, coach_id, amount, status")
        .eq("id", withdrawalId)
        .eq("coach_id", coachId)
        .single();

    if (fetchErr || !withdrawal) {
        return NextResponse.json({ success: false, message: "未找到该提现记录", data: null }, { status: 404 });
    }

    // 只能撤回 pending 状态的提现
    if (withdrawal.status !== "pending") {
        return NextResponse.json({ success: false, message: "只能撤回待处理状态的提现", data: null }, { status: 400 });
    }

    // 数据库存储的是分（整数）
    const amountFen = Number(withdrawal.amount || 0);
    if (amountFen <= 0) {
        return NextResponse.json({ success: false, message: "提现金额异常", data: null }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 使用事务确保一致性（在单体架构中，使用顺序操作尽量保证）
    try {
        // 1. 更新提现状态为 cancelled
        const { error: updateErr } = await serviceRoleSupabase
            .from("alipay_withdrawals")
            .update({
                status: "cancelled",
                processed_at: now,
            })
            .eq("id", withdrawalId)
            .eq("coach_id", coachId)
            .eq("status", "pending"); // 双重检查，确保状态还是 pending

        if (updateErr) {
            console.error("[Withdraw Cancel] Update withdrawal status failed", updateErr);
            return NextResponse.json({ success: false, message: "撤回失败", data: null }, { status: 500 });
        }

        // 2. 退回余额到钱包（使用整数相加避免精度问题）
        const { data: wallet } = await serviceRoleSupabase
            .from("coach_wallets")
            .select("balance")
            .eq("coach_id", coachId)
            .single();

        if (!wallet) {
            // 如果钱包不存在，创建它（存储分）
            await serviceRoleSupabase.from("coach_wallets").insert({
                coach_id: coachId,
                balance: amountFen,
                total_income: 0,
                frozen_amount: 0,
                created_at: now,
                updated_at: now,
            });
        } else {
            const currentBalanceFen = Number(wallet.balance ?? 0);
            const newBalanceFen = addFen(currentBalanceFen, amountFen);
            await serviceRoleSupabase
                .from("coach_wallets")
                .update({ balance: newBalanceFen, updated_at: now })
                .eq("coach_id", coachId);
        }

        // 3. 将原提现流水的描述改为「已撤回」
        const amountYuanStr = formatYuanFromFen(amountFen);
        await serviceRoleSupabase
            .from("wallet_transactions")
            .update({ description: `提现 ${amountYuanStr}（已撤回）` })
            .eq("related_withdrawal_id", withdrawalId);

        // 4. 记录退回流水（存储分）
        await serviceRoleSupabase.from("wallet_transactions").insert({
            wallet_id: coachId,
            amount: amountFen, // 存储分（整数）
            type: "refund",
            description: `提现撤回，退回 ${amountYuanStr} 元`,
            created_at: now,
        });

        return NextResponse.json<ApiData<{ id: string }>>({
            success: true,
            message: "提现已撤回，余额已退回",
            data: { id: withdrawalId },
        });
    } catch (err) {
        console.error("[Withdraw Cancel] Unexpected error", err);
        return NextResponse.json({ success: false, message: "撤回失败", data: null }, { status: 500 });
    }
}
