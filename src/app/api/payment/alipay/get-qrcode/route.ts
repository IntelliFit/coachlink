import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetAlipayQrcodeDto, GetAlipayQrcodeResponseDto } from './entity';

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

    const { order_id } = await req.json() as GetAlipayQrcodeDto;

    if (!order_id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '订单交易号不能为空',
            data: null
        }, { status: 400 });
    }

    // 查询订单
    const { data: order, error: orderError } = await supabase
        .from('alipay_orders')
        .select('*')
        .eq('out_trade_no', order_id)
        .single();

    // 如果查不到，返回错误
    if (orderError || !order) {
        // 获取最近的订单用于调试
        // const { data: recentOrders, error: recentError } = await supabase
        //     .from('alipay_orders')
        //     .select('id, out_trade_no, subject, status, created_at')
        //     .order('created_at', { ascending: false })
        //     .limit(5);

        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '订单不存在',
            data: null
        }, { status: 404 });
    }

    // 检查订单状态
    if (order.status !== 'pending') {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '订单状态不允许生成二维码',
            data: null
        }, { status: 400 });
    }

    // 如果订单已经有二维码，直接返回
    if (order.qr_code) {
        return NextResponse.json<ApiData<GetAlipayQrcodeResponseDto>>({
            success: true,
            message: '二维码获取成功',
            data: {
                qr_code: order.qr_code,
                order_id: order.id.toString(),
                out_trade_no: order.out_trade_no
            }
        });
    }

    // 如果没有二维码，返回错误
    return NextResponse.json<ApiData<null>>({
        success: false,
        message: '订单尚未生成二维码',
        data: null
    }, { status: 400 });
}