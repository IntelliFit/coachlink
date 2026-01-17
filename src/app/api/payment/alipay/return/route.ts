import { NextResponse } from 'next/server';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import { sendSystemMessage } from '@/lib/chat';

async function tryAutoConfirmSubscriptionByOrderId(orderId: string) {
    const { data: order, error: orderErr } = await serviceRoleSupabase
        .from('alipay_orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (orderErr || !order) return;

    if (!(order.order_type === 'subscription' || order.order_type === 'subscription_renew')) return;
    if (order.status !== 'paid') return;

    const orderData: any = order.order_data || {};
    const subscriptionId = orderData?.subscriptionId as string | undefined;
    const coachId = orderData?.coachId as string | undefined;

    if (!subscriptionId) return;

    const { data: sub } = await serviceRoleSupabase
        .from('coach_subscriptions')
        .select('id, student_id, coach_id, status, start_date, end_date, subscribed_weeks, last_payment_order_id')
        .eq('id', subscriptionId)
        .single();

    if (!sub) return;
    if (coachId && sub.coach_id !== coachId) return;

    if (sub.last_payment_order_id === order.id) return;

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
        console.error('[Alipay Return] Failed to send coach system message:', e);
    }
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const params = Object.fromEntries(url.searchParams);
        
        // 提取关键参数
        const {
            out_trade_no,  // 商户订单号
            trade_no,      // 支付宝交易号
            total_amount   // 交易金额
        } = params;
        
        // 验证必要参数
        if (!out_trade_no || !trade_no) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: '回调参数错误，缺少必要参数',
                data: null
            }, { status: 400 });
        }
        
        // 更新订单状态（兼容：我们以 alipay_orders.id 作为 out_trade_no）
        const { data: order, error } = await serviceRoleSupabase
            .from('alipay_orders')
            .update({
                status: 'paid',
                trade_status: 'TRADE_SUCCESS',
                alipay_trade_no: trade_no,
                updated_at: new Date().toISOString()
            })
            .eq('id', out_trade_no)
            .select()
            .single();
        
        if (error) {
            console.error('更新订单状态失败:', error);
        }

        if (order?.id) {
            await tryAutoConfirmSubscriptionByOrderId(order.id);
        }
        
        // 重定向回应用的支付成功页面
        const redirectUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment/${out_trade_no}`;
        
        return NextResponse.redirect(redirectUrl);
        
    } catch (error) {
        console.error('支付回调处理失败:', error);
        
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '回调处理失败',
            data: null
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        let params: any = {};
        
        const contentType = req.headers.get('content-type') || '';
        
        if (contentType.includes('application/x-www-form-urlencoded')) {
            // 表单数据
            const body = await req.text();
            params = Object.fromEntries(new URLSearchParams(body));
        } else if (contentType.includes('application/json')) {
            // JSON 数据
            params = await req.json();
        }
        
        // 提取关键参数
        const {
            out_trade_no,  // 商户订单号
            trade_no,      // 支付宝交易号
            total_amount   // 交易金额
        } = params;
        
        // 验证必要参数
        if (!out_trade_no || !trade_no) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: '回调参数错误，缺少必要参数',
                data: null
            }, { status: 400 });
        }
        
        // 更新订单状态（兼容：我们以 alipay_orders.id 作为 out_trade_no）
        const { data: order, error } = await serviceRoleSupabase
            .from('alipay_orders')
            .update({
                status: 'paid',
                trade_status: 'TRADE_SUCCESS',
                alipay_trade_no: trade_no,
                updated_at: new Date().toISOString()
            })
            .eq('id', out_trade_no)
            .select()
            .single();
        
        if (error) {
            console.error('更新订单状态失败:', error);
        }

        if (order?.id) {
            await tryAutoConfirmSubscriptionByOrderId(order.id);
        }
        
        // 重定向回应用的支付成功页面
        const redirectUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment/${out_trade_no}`;
        
        return NextResponse.redirect(redirectUrl);
        
    } catch (error) {
        console.error('支付回调处理失败:', error);
        
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '回调处理失败',
            data: null
        }, { status: 500 });
    }
}