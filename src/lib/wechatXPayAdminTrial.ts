import type { NextRequest } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import { getWechatXPayConfig } from '@/lib/wechatXPay';

export const XPAY_TRIAL_HEADER = 'x-coachlink-xpay-admin-trial';

// Never enables purchases on main or accepts a local-debug identity.
export async function requireXPayTrialAdmin(request: NextRequest) {
    if (process.env.APOLLO_CLUSTER !== 'dev' || getWechatXPayConfig().env !== 1) {
        throw new Error('支付联调仅在体验后端的沙箱环境开放');
    }
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ') || authorization.slice(7).startsWith('cldev')) {
        throw new Error('请使用本人微信账号登录体验版');
    }
    const userId = await getApiUserId(request);
    if (!userId) throw new Error('请先登录');
    const { data, error } = await serviceRoleSupabase.from('users')
        .select('id, is_admin, wechat_openid').eq('id', userId).maybeSingle();
    if (error || !data?.is_admin || !data.wechat_openid) throw new Error('仅微信已绑定的管理员可联调');
    return String(data.id);
}

export async function readXPayTrialState(userId: string) {
    const db = serviceRoleSupabase as any;
    const [quota, order] = await Promise.all([
        db.from('student_quotas').select('ai_import_balance').eq('user_id', userId).maybeSingle(),
        db.from('alipay_orders').select('id, status, order_data')
            .eq('user_id', userId).eq('payment_provider', 'wechat_xpay')
            .eq('order_data->>xpay_admin_trial', 'true').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (quota.error || order.error) throw new Error('读取支付联调记录失败');
    return { env: 1, amount: 2, aiBalance: Number(quota.data?.ai_import_balance || 0), order: order.data || null };
}

// The single trial grant is recoverable after an interrupted request: CAS the
// recorded balance, then record delivery. Changed balances fail closed for review.
export async function fulfillXPayAdminTrial(order: Record<string, any>) {
    const db = serviceRoleSupabase as any;
    const data = order.order_data || {};
    if (order.status !== 'paid' || data.product_key !== 'ai_pack_basic' || data.xpay_env !== 1) {
        throw new Error('支付联调订单不匹配');
    }
    if (!data.xpay_trial_granted_at) {
        const before = Number(data.xpay_trial_balance_before);
        if (!Number.isSafeInteger(before) || before < 0) throw new Error('联调额度快照无效');
        const target = before + 3;
        const { error: initError } = await db.from('student_quotas')
            .upsert({ user_id: order.user_id, ai_import_balance: 0, storage_total_mb: 500, storage_used_mb: 0 },
                { onConflict: 'user_id', ignoreDuplicates: true });
        if (initError) throw new Error('初始化额度失败');
        const { error: grantError } = await db.from('student_quotas')
            .update({ ai_import_balance: target }).eq('user_id', order.user_id).eq('ai_import_balance', before);
        if (grantError) throw new Error('联调额度发放失败');
        const { data: quota, error: quotaError } = await db.from('student_quotas')
            .select('ai_import_balance').eq('user_id', order.user_id).single();
        if (quotaError || Number(quota?.ai_import_balance) !== target) {
            throw new Error('额度在联调期间发生变化，请联系管理员核对，未确认发货');
        }
        const { error } = await db.from('alipay_orders').update({
            order_data: { ...data, xpay_trial_granted_at: new Date().toISOString(), xpay_trial_balance_after: target },
        }).eq('id', order.id).eq('status', 'paid');
        if (error) throw new Error('记录联调发货失败');
    }
    const { error } = await db.from('student_membership_orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', data.related_order_id).eq('user_id', order.user_id).eq('status', 'pending');
    if (error) throw new Error('记录联调业务订单失败');
}
