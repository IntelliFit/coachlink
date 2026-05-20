import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';

import { createAlipaySdk } from '@/lib/alipaySdk';
import {
    fulfillSubscriptionAndMaybeCreditWallet,
} from '@/app/api/payment/alipay/fulfillPaidOrder';

import type { ApiData } from '@/types/api';
import type { QueryAlipayOrderDto, QueryAlipayOrderResponseDto, TradeStatus } from './entity';
import { fenToYuan } from '@/lib/moneyUtils';
import { fulfillContentPurchasePaid } from '../contentPurchaseFulfillment';
import { formatHuifuReqDate, queryHuifuMiniProgramOrder } from '@/lib/huifuMiniProgramPay';

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
    const userId = session?.user?.id || '';

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
    const dbClient = userId ? supabase : serviceRoleSupabase;
    const { data: existOrder, error: existOrderError } = await dbClient
        .from('alipay_orders')
        .select()
        .eq('id', orderId)
        .single();

    if (existOrderError || !existOrder) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '订单不存在',
            data: null
        }, { status: 404 });
    }

    if (!userId && existOrder?.order_type !== 'guest_content_purchase') {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    if (!existOrderError && existOrder.status === 'paid') {
        // 将金额从分转换为元返回给前端
        const orderWithYuan = {
            ...existOrder,
            total_amount: fenToYuan(existOrder.total_amount ?? 0),
        };
        return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
            success: true,
            message: '订单已支付',
            data: {
                order: orderWithYuan,
                tradeStatus: existOrder.trade_status as TradeStatus
            }
        });
    }

    const existOrderData = (existOrder.order_data || {}) as Record<string, any>;
    const paymentProvider = String((existOrder as any).payment_provider || '').trim();
    const isHuifuGatewayOrder =
        paymentProvider === 'huifu_alipay' ||
        paymentProvider === 'wechat' ||
        Boolean(existOrderData.huifu_req_date);

    if (isHuifuGatewayOrder) {
        const queryResult = await queryHuifuMiniProgramOrder({
            orgReqDate: String(existOrderData.huifu_req_date || formatHuifuReqDate(new Date(existOrder.created_at))),
            orgReqSeqId: String(existOrder.id),
        });

        const orderStatus =
            queryResult.trans_stat === 'S'
                ? 'paid'
                : queryResult.trans_stat === 'F'
                  ? 'failed'
                  : 'pending';

        const { data: order, error: orderError } = await (serviceRoleSupabase as any)
            .from('alipay_orders')
            .update({
                status: orderStatus,
                trade_status: queryResult.trans_stat || null,
                alipay_trade_no: queryResult.org_hf_seq_id || null,
                payment_provider: paymentProvider || 'huifu_alipay',
                updated_at: new Date().toISOString(),
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

        if (orderStatus === 'paid' && order && userId) {
            if (
                order.order_type === 'subscription' ||
                order.order_type === 'subscription_renew' ||
                order.order_type === 'coach_subscription' ||
                order.order_type === 'coach_subscription_renew'
            ) {
                await fulfillSubscriptionAndMaybeCreditWallet(
                    order as any,
                    userId,
                    paymentProvider === 'wechat' ? 'wechat' : 'alipay',
                );
            }

            if (order.order_type === 'content_purchase') {
                const orderData: any = order.order_data || {};
                const contentId = orderData?.contentId as string | undefined;
                if (contentId) {
                    try {
                        await fulfillContentPurchasePaid({
                            orderId: order.id,
                            userId,
                            contentId,
                        });
                    } catch (e) {
                        console.error('[Alipay Query] Content purchase fulfill failed:', e);
                    }
                }
            }
        }

        const orderWithYuan = order
            ? {
                ...order,
                total_amount: fenToYuan(order.total_amount ?? 0),
            }
            : order;

        return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
            success: true,
            message: '支付状态',
            data: {
                order: orderWithYuan,
                tradeStatus: (queryResult.trans_stat as unknown) as TradeStatus,
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
        console.error('[Alipay Query] 查询支付宝失败，返回本地订单状态:', error);
        // 支付网关不可用时仍返回本地订单数据，让前端继续轮询而不是崩掉
        const orderWithYuan = {
            ...existOrder,
            total_amount: fenToYuan(existOrder.total_amount ?? 0),
        };
        return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
            success: true,
            message: '支付网关暂不可用，显示本地订单状态',
            data: {
                order: orderWithYuan,
                tradeStatus: (existOrder.trade_status as TradeStatus) || 'WAIT_BUYER_PAY',
            }
        });
    }

    let orderStatus: 'pending' | 'paid' | 'closed' = 'pending';
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
        orderStatus = 'paid';
    } else if (tradeStatus === 'TRADE_CLOSED') {
        orderStatus = 'closed'; // 数据库约束：pending|paid|failed|closed|refunded
    }

    // Update local order status snapshot
    const { data: order, error: orderError } = await dbClient
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
    if (orderStatus === 'paid' && order && userId) {
        if (order.order_type === 'subscription' || order.order_type === 'subscription_renew' || order.order_type === 'coach_subscription' || order.order_type === 'coach_subscription_renew') {
            await fulfillSubscriptionAndMaybeCreditWallet(
                order as any,
                userId,
                (order as any).payment_provider === 'wechat' ? 'wechat' : 'alipay',
            );
        }

        if (order.order_type === 'content_purchase') {
            const orderData: any = order.order_data || {};
            const contentId = orderData?.contentId as string | undefined;
            if (contentId) {
                try {
                    await fulfillContentPurchasePaid({
                        orderId: order.id,
                        userId,
                        contentId,
                    });
                } catch (e) {
                    console.error('[Alipay Query] Content purchase fulfill failed:', e);
                }
            }
        }
    }

    // 将金额从分转换为元返回给前端
    const orderWithYuan = order
        ? {
            ...order,
            total_amount: fenToYuan(order.total_amount ?? 0),
        }
        : order;
    return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
        success: true,
        message: '支付状态',
        data: {
            order: orderWithYuan,
            tradeStatus: tradeStatus as TradeStatus
        }
    });
}
