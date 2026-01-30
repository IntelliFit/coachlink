import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';

import { AlipaySdk } from 'alipay-sdk';

import type { ApiData } from '@/types/api';
import type { QueryAlipayOrderDto, QueryAlipayOrderResponseDto, TradeStatus } from './entity';
import { sendSystemMessage } from '@/lib/chat';

// 文档：https://opendocs.alipay.com/open/217dd591_alipay.trade.query?scene=common&pathHash=62ae74aa
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;

    const body = await req.json() as (QueryAlipayOrderDto & { paymentId?: string });
    const orderId = body.orderId || body.paymentId;

    if (!orderId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '订单ID不能为空',
            data: null
        }, { status: 400 });
    }

const alipaySdk = new AlipaySdk({
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY,
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
    gateway: process.env.ALIPAY_GATEWAY
});

const response = await alipaySdk.exec('alipay.trade.query', {
    bizContent: {
        out_trade_no: orderId
    }
});
    
    console.log(response);
    /*
response 成功输出
{
    code: '10000',
    msg: 'Success',
    buyerLogonId: '135******18',
    buyerPayAmount: '0.00',
    invoiceAmount: '0.00',
    outTradeNo: '7d8711cc-ea1f-42b9-97a6-8293908eaca1',
    pointAmount: '0.00',
    receiptAmount: '0.00',
    sendPayDate: '2026-01-16 22:50:47',
    totalAmount: '0.01',
    tradeNo: '2026011622001420201419924360',
    tradeStatus: 'TRADE_SUCCESS',
    buyerOpenId: '02055P9mYaqtYOsLTnozQBxheELa2otJrK_rNmTzSXKMfA3',
    traceId: '21d6638e17685751514775668e7bd0'
}

    */
    const tradeStatus = response?.tradeStatus as string | undefined;

    let orderStatus: 'pending' | 'paid' | 'cancelled' = 'pending';
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
        orderStatus = 'paid';
    } else if (tradeStatus === 'TRADE_CLOSED') {
        orderStatus = 'cancelled';
    }

    // Update local order status snapshot
    const { data: order, error: orderError } = await supabase
        .from('alipay_orders')
        .update({
            status: orderStatus,
            trade_status: tradeStatus || null,
            alipay_trade_no: response?.tradeNo || null,
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

    if (orderError) {
        return NextResponse.json({
            success: false,
            message: orderError.message,
        });
    }
    
    // Auto-confirm subscription/renew (useful in dev where notify may not fire)
    if (
        orderStatus === 'paid' &&
        order?.order_type &&
        (order.order_type === 'subscription' || order.order_type === 'subscription_renew')
    ) {
        const orderData: any = order.order_data || {};
        const subscriptionId = orderData?.subscriptionId as string | undefined;
        const coachId = orderData?.coachId as string | undefined;

        if (subscriptionId) {
            const { data: sub } = await serviceRoleSupabase
                .from('coach_subscriptions')
                .select('id, student_id, coach_id, status, start_date, end_date, subscribed_weeks, last_payment_order_id')
                .eq('id', subscriptionId)
                .single();

            if (sub && sub.student_id === userId && (!coachId || sub.coach_id === coachId)) {
                if (sub.last_payment_order_id !== order.id) {
                    const nowIso = new Date().toISOString();
                    const update: Record<string, unknown> = {
                        payment_method: 'platform_alipay',
                        payment_confirmed_by: 'system',
                        payment_confirmed_at: nowIso,
                        coach_seen_at: null,
                        last_payment_order_id: order.id,
                        order_id: order.id,
                    };

                    if (order.order_type === 'subscription') {
                        update.status = 'active';
                        // Do not set end_date here. We start counting only when the coach assigns the first plan.
                    }

                    if (order.order_type === 'subscription_renew') {
                        const weeks = Number(orderData?.renewAdditionalWeeks || 0);
                        if (weeks > 0) {
                            update.subscribed_weeks = Number(sub.subscribed_weeks || 0) + weeks;
                            if (sub.end_date) {
                                const base = new Date(sub.end_date);
                                const now = new Date();
                                const effectiveBase = base.getTime() < now.getTime() ? now : base;
                                effectiveBase.setDate(effectiveBase.getDate() + weeks * 7);
                                update.end_date = effectiveBase.toISOString();
                            }
                        }
                    }

                    await serviceRoleSupabase
                        .from('coach_subscriptions')
                        .update(update)
                        .eq('id', subscriptionId);

                    // best-effort coach notify
                    try {
                        const { data: coach } = await serviceRoleSupabase
                            .from('coaches')
                            .select('user_id')
                            .eq('id', sub.coach_id)
                            .single();
                        if (coach?.user_id) {
                            await sendSystemMessage(coach.user_id, {
                                content: `新的学员订阅通过【平台支付】完成，系统已自动确认。请前往 [我的学员](/dashboard/students) 查看。`,
                            });
                        }
                    } catch (e) {
                        console.error('[Alipay Query] Failed to send coach system message:', e);
                    }
                }
            }
        }
    }

    return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
        success: true,
        message: '支付状态',
        data: {
            order: order,
            tradeStatus: tradeStatus as TradeStatus
        }
    });
}