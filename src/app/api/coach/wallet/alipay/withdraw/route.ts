import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { WithdrawDto, WithdrawResponse } from "../entity";
import { AlipaySdk } from "alipay-sdk";

const normalizePayeeType = (input?: string | null) => {
    if (!input) return "ALIPAY_LOGON_ID";
    if (input === "ALIPAY_LOGONID") return "ALIPAY_LOGON_ID";
    return input;
};

async function getCoachIdByUser(userId: string) {
    const { data: coach } = await supabase.from("coaches").select("id").eq("user_id", userId).single();
    return coach?.id || null;
}

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

    // Load wallet
    const { data: wallet } = await supabase.from("coach_wallets").select("balance, frozen_amount").eq("coach_id", coachId).single();
    const balance = Number(wallet?.balance || 0);
    if (balance < amount) {
        return NextResponse.json({ success: false, message: "余额不足", data: null }, { status: 400 });
    }

    // Find account to pay to
    const { data: account } = await supabase.from("alipay_accounts").select("id, payee_account, payee_type, real_name, verified").eq("coach_id", coachId).single();
    if (!account) {
        return NextResponse.json({ success: false, message: "未绑定支付宝账户，请先绑定", data: null }, { status: 400 });
    }

    const identityType = normalizePayeeType(account.payee_type);
    if (identityType === "ALIPAY_LOGON_ID" && !account.real_name) {
        return NextResponse.json({ success: false, message: "该支付宝账号缺少实名信息，请重新绑定并填写真实姓名", data: null }, { status: 400 });
    }

    // create withdrawal record and deduct balance
    const out_biz_no = `wd_${crypto.randomUUID()}`;

    // 1) Create withdrawal record
    const { data: withdrawal, error: werr } = await serviceRoleSupabase.from("alipay_withdrawals").insert({
        wallet_id: coachId,
        coach_id: coachId,
        amount,
        fee: 0,
        status: 'pending',
        out_biz_no,
        created_at: new Date().toISOString()
    }).select().single();

    if (werr || !withdrawal) {
        return NextResponse.json({ success: false, message: werr?.message || '创建提现记录失败', data: null }, { status: 500 });
    }

    // 2) Deduct wallet balance and insert withdrawal transaction
    try {
        await serviceRoleSupabase.from("coach_wallets").update({ balance: balance - amount, updated_at: new Date().toISOString() }).eq('coach_id', coachId);
        await serviceRoleSupabase.from('wallet_transactions').insert({ wallet_id: coachId, amount: -Math.abs(amount), type: 'withdrawal', description: `提现 ${amount.toFixed(2)}`, created_at: new Date().toISOString() });
    } catch (err) {
        console.error('[Withdraw] Deduct wallet failed', err);
        await serviceRoleSupabase.from('alipay_withdrawals').update({ status: 'failed', processed_at: new Date().toISOString() }).eq('id', withdrawal.id);
        return NextResponse.json({ success: false, message: '钱包扣款失败', data: null }, { status: 500 });
    }

    // 3) Call Alipay transfer API (or mock in dev)

    const { ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY, ALIPAY_GATEWAY } = process.env;
    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY || !ALIPAY_PUBLIC_KEY) {
        // Refund and fail: configuration incomplete
        await serviceRoleSupabase.from('alipay_withdrawals').update({ status: 'failed', alipay_response: { error: 'missing_alipay_config' }, processed_at: new Date().toISOString() }).eq('id', withdrawal.id);
        // refund
        await serviceRoleSupabase.from('coach_wallets').update({ balance: balance, updated_at: new Date().toISOString() }).eq('coach_id', coachId);
        await serviceRoleSupabase.from('wallet_transactions').insert({ wallet_id: coachId, amount: amount, type: 'refund', description: '提现失败，退款', created_at: new Date().toISOString() });
        return NextResponse.json({ success: false, message: '支付宝未配置，无法发起提现', data: null }, { status: 500 });
    }

    const alipaySdk = new AlipaySdk({ appId: ALIPAY_APP_ID, privateKey: ALIPAY_PRIVATE_KEY, alipayPublicKey: ALIPAY_PUBLIC_KEY, gateway: ALIPAY_GATEWAY });

    try {
        const payeeInfo: Record<string, string> = {
            identity: account.payee_account,
            identity_type: identityType,
        };
        if (account.real_name) {
            payeeInfo.name = account.real_name;
        }

        const bizContent = {
            out_biz_no,
            trans_amount: amount.toFixed(2),
            biz_scene: 'DIRECT_TRANSFER',
            product_code: 'TRANS_ACCOUNT_NO_PWD',
            order_title: '教练钱包提现',
            payee_info: payeeInfo,
            remark: `教练提现 ${coachId}`,
        } as const;

        const resp = await alipaySdk.exec('alipay.fund.trans.uni.transfer', { bizContent });
        const transferResponse = (resp as any)?.alipay_fund_trans_uni_transfer_response ?? resp;

        if (transferResponse?.code === '10000' && transferResponse?.status === 'SUCCESS') {
            await serviceRoleSupabase
                .from('alipay_withdrawals')
                .update({
                    status: 'success',
                    alipay_order_id: transferResponse.order_id || null,
                    alipay_response: transferResponse,
                    processed_at: new Date().toISOString(),
                })
                .eq('id', withdrawal.id);

            return NextResponse.json({ success: true, message: '提现成功', data: { id: withdrawal.id, status: 'success', out_biz_no } as WithdrawResponse });
        }

        const failMsg =  '提现失败，请稍后再试';
        console.error('[Alipay Transfer] failed:', transferResponse);
        await serviceRoleSupabase
            .from('alipay_withdrawals')
            .update({ status: 'failed', alipay_response: transferResponse, processed_at: new Date().toISOString() })
            .eq('id', withdrawal.id);
        await serviceRoleSupabase.from('coach_wallets').update({ balance: balance, updated_at: new Date().toISOString() }).eq('coach_id', coachId);
        await serviceRoleSupabase.from('wallet_transactions').insert({ wallet_id: coachId, amount: amount, type: 'refund', description: '提现失败，退款', created_at: new Date().toISOString() });
        return NextResponse.json({ success: false, message: failMsg, data: null }, { status: 500 });
    } catch (err) {
        console.error('[Alipay Transfer] error:', err);
        await serviceRoleSupabase.from('alipay_withdrawals').update({ status: 'failed', alipay_response: { error: String(err) }, processed_at: new Date().toISOString() }).eq('id', withdrawal.id);
        await serviceRoleSupabase.from('coach_wallets').update({ balance: balance, updated_at: new Date().toISOString() }).eq('coach_id', coachId);
        await serviceRoleSupabase.from('wallet_transactions').insert({ wallet_id: coachId, amount: amount, type: 'refund', description: '提现失败，退款', created_at: new Date().toISOString() });
        return NextResponse.json({ success: false, message: '调用支付宝接口异常，已退款', data: null }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, message: '缺少提现ID', data: null }, { status: 400 });
    const { data } = await supabase.from('alipay_withdrawals').select('*').eq('id', id).single();
    if (!data) return NextResponse.json({ success: false, message: '未找到记录', data: null }, { status: 404 });
    return NextResponse.json({ success: true, message: '提现记录', data });
}
