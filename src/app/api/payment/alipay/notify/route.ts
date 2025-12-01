import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';

export async function POST(req: Request) {
    try {
        // 获取回调数据
        const callbackData = await req.json();

        if (!callbackData) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: '回调数据不能为空',
                data: null
            }, { status: 400 });
        }

        // 这里应该验证支付宝回调的签名
        // 由于没有实际的支付宝配置，我们暂时返回验证成功
        // 在实际生产环境中，需要验证签名确保回调的真实性

        const { out_trade_no, trade_status } = callbackData;

        if (!out_trade_no) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: '订单号不能为空',
                data: null
            }, { status: 400 });
        }

        // 根据支付宝回调状态更新订单
        let orderStatus = 'pending';
        if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
            orderStatus = 'paid';
        } else if (trade_status === 'TRADE_CLOSED') {
            orderStatus = 'cancelled';
        }

        // 更新订单状态
        const { error: updateError } = await supabase
            .from('alipay_orders')
            .update({
                status: orderStatus,
                updated_at: new Date().toISOString()
            })
            .eq('out_trade_no', out_trade_no);

        if (updateError) {
            console.error('更新订单状态失败:', updateError);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: '更新订单状态失败',
                data: null
            }, { status: 500 });
        }

        // 返回成功响应给支付宝
        return new Response('success', {
            status: 200,
            headers: {
                'Content-Type': 'text/plain'
            }
        });

    } catch (error) {
        console.error('处理请求时发生错误:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '服务器内部错误',
            data: null
        }, { status: 500 });
    }
}