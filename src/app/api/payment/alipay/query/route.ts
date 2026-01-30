import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import { createAlipaySdk } from '@/lib/alipaySdk';
import {
    updateTransactionAndWallet,
    fulfillSubscriptionOnPaid,
} from '@/app/api/payment/alipay/fulfillPaidOrder';

import type { ApiData } from '@/types/api';
import type { QueryAlipayOrderDto, QueryAlipayOrderResponseDto, TradeStatus } from './entity';

// 文档：https://opendocs.alipay.com/open/217dd591_alipay.trade.query?scene=common&pathHash=62ae74aa

const getTraceNoAndStatus = async (orderId: string): Promise<{ traceNo: string | null; tradeStatus: string | null }> => {
    // if (false) {
    //     // Mock response for non-production environments
    //     console.log('[Alipay Query] 开发环境无法调用真实接口，直接认为支付成功');
    //     return {
    //         traceNo: 'mock_trace_no_123456',
    //         tradeStatus: 'TRADE_SUCCESS'
    //     }
    // } else {
        // 使用统一的初始化工具，支持代理配置
    const alipaySdk = createAlipaySdk();

    const response = await alipaySdk.exec('alipay.trade.query', {
        bizContent: {
            out_trade_no: orderId
        }
    });

    if (response?.code !== '10000') {
        console.error(`[Alipay Query] alipay.trade.query failed: ${JSON.stringify(response)}`);
        throw new Error(`[Alipay Query] alipay.trade.query failed: ${response?.msg}`);
    }
    console.log('[Alipay Query] alipay.trade.query response:', response);
    const traceNo = response?.traceId as string | null || null;
    const tradeStatus = response?.tradeStatus as string | null || null;
    return { traceNo, tradeStatus };
    
}

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

    // 查询是否已经支付成功
    const { data: existOrder, error: existOrderError } = await supabase
        .from('alipay_orders')
        .select()
        .eq('id', orderId)
        .single();

    if (!existOrderError && existOrder.status === 'paid') {
        return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
            success: true,
            message: '订单已支付',
            data: {
                order: existOrder,
                tradeStatus: existOrder.trade_status as TradeStatus
            }
        });
    }


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
    let traceNo: string | null = null;
    let tradeStatus: string | null = null;
    try { 
        const result = await getTraceNoAndStatus(orderId);
        traceNo = result.traceNo;
        tradeStatus = result.tradeStatus;
    } catch (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error instanceof Error ? error.message : '获取支付宝订单状态失败',
            data: null
        }, { status: 500 });
    }

    let orderStatus: 'pending' | 'paid' | 'closed' = 'pending';
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
        orderStatus = 'paid';
    } else if (tradeStatus === 'TRADE_CLOSED') {
        orderStatus = 'closed'; // 数据库约束：pending|paid|failed|closed|refunded
    }

    // Update local order status snapshot
    const { data: order, error: orderError } = await supabase
        .from('alipay_orders')
        .update({
            status: orderStatus,
            trade_status: tradeStatus || null,
            alipay_trade_no: traceNo || null,
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

    // 订阅/续费确认 + 钱包入账（与 notify/return 共用逻辑，幂等）
    if (orderStatus === 'paid' && order) {
        if (order.order_type === 'subscription' || order.order_type === 'subscription_renew') {
            await fulfillSubscriptionOnPaid(order, orderId, userId);
        }
        await updateTransactionAndWallet(order);
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