import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { QueryAlipayOrderDto, QueryAlipayOrderResponseDto } from './entity';

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

    const { order_id } = await req.json() as QueryAlipayOrderDto;

    if (!order_id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '订单ID不能为空',
            data: null
        }, { status: 400 });
    }

    // 获取订单信息
    let order, orderError;
    
    // 判断order_id是数字还是字符串（如果是ALIPAY_开头，则是out_trade_no）
    const isTradeNo = typeof order_id === 'string' && order_id.startsWith('ALIPAY_');
    
    if (isTradeNo) {
        const result = await supabase
            .from('alipay_orders')
            .select('*')
            .eq('out_trade_no', order_id)
            .single();
        order = result.data;
        orderError = result.error;
    } else {
        const result = await supabase
            .from('alipay_orders')
            .select('*')
            .eq('id', order_id)
            .single();
        order = result.data;
        orderError = result.error;
        
        // 如果按ID查不到，尝试按out_trade_no查询
        if (orderError) {
            const tradeNoResult = await supabase
                .from('alipay_orders')
                .select('*')
                .eq('out_trade_no', order_id)
                .single();
            
            if (tradeNoResult.data) {
                order = tradeNoResult.data;
                orderError = null;
            }
        }
    }

    if (orderError || !order) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '订单不存在',
            data: null
        }, { status: 404 });
    }

    // 检查订单是否过期（15分钟）
    const orderTime = new Date(order.created_at);
    const now = new Date();
    const timeDiff = now.getTime() - orderTime.getTime();
    const minutesDiff = timeDiff / (1000 * 60);

    if (minutesDiff > 15 && order.status === 'pending') {
        // 订单超时，更新状态
        const { error: updateError } = await supabase
            .from('alipay_orders')
            .update({
                status: 'expired',
                updated_at: new Date().toISOString()
            })
            .eq('id', order.id);

        if (!updateError) {
            order.status = 'expired';
            order.updated_at = new Date().toISOString();
        }
    }

    return NextResponse.json<ApiData<QueryAlipayOrderResponseDto>>({
        success: true,
        message: '订单查询成功',
        data: {
            order: {
                id: order.id,
                out_trade_no: order.out_trade_no,
                subject: order.subject,
                total_amount: order.total_amount,
                status: order.status,
                trade_status: order.trade_status,
                qr_code: order.qr_code,
                created_at: order.created_at,
                updated_at: order.updated_at
            }
        }
    });
}