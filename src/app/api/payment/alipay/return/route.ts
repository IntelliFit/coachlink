import { NextResponse } from 'next/server';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import {
    fulfillSubscriptionOnPaid,
    updateTransactionAndWallet,
} from '@/app/api/payment/alipay/fulfillPaidOrder';

/** return 同步跳转后的履约（与 notify/query 共用逻辑，幂等） */
async function fulfillPaidOrderIfNeeded(order: { id: string; user_id?: string | null; order_type?: string | null; order_data?: unknown }) {
    if (!order?.user_id) return;
    if (order.order_type === 'subscription' || order.order_type === 'subscription_renew') {
        await fulfillSubscriptionOnPaid(order, order.id, order.user_id);
    }
    await updateTransactionAndWallet(order);
}

function resolveRedirectBaseUrl(req: Request) {
    const xfProto = req.headers.get("x-forwarded-proto");
    const xfHost = req.headers.get("x-forwarded-host");
    const host = req.headers.get("host");
    const proto = xfProto || (host?.includes("localhost") ? "http" : "https");
    if (xfHost || host) {
        return `${proto}://${xfHost || host}`;
    }
    return process.env.NEXTAUTH_URL || "http://localhost:3000";
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
            await fulfillPaidOrderIfNeeded(order);
        }
        
        const redirectBaseUrl = resolveRedirectBaseUrl(req);
        const redirectUrl = `${redirectBaseUrl}/payment/${out_trade_no}`;
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
            await fulfillPaidOrderIfNeeded(order);
        }
        
        const redirectBaseUrl = resolveRedirectBaseUrl(req);
        const redirectUrl = `${redirectBaseUrl}/payment/${out_trade_no}`;
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