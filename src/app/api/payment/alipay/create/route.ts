import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { CreateAlipayOrderDto, CreateAlipayOrderResponseDto } from './entity';
import { AlipaySdk } from 'alipay-sdk';

// 文档：https://opendocs.alipay.com/open/59da99d0_alipay.trade.page.pay?pathHash=e26b497f&scene=22
export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: '用户未登录', data: null },
            { status: 401 }
        );
    }

    const userId = session.user.id;

    // 读取参数
    const {
        subject,
        total_amount,
        order_type,
        order_data,
    } = (await req.json()) as CreateAlipayOrderDto;

    if (!subject || !total_amount) {
        return NextResponse.json(
            { success: false, message: '缺少必要参数', data: null },
            { status: 400 }
        );
    }

    // 读取支付宝配置
    const {
        ALIPAY_APP_ID,
        ALIPAY_PRIVATE_KEY,
        ALIPAY_PUBLIC_KEY,
        ALIPAY_GATEWAY
    } = process.env;

    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY || !ALIPAY_PUBLIC_KEY) {
        return NextResponse.json(
            { success: false, message: '支付宝配置不完整', data: null },
            { status: 500 }
        );
    }

    // 初始化 alipay-sdk
    const alipaySdk = new AlipaySdk({
        appId: ALIPAY_APP_ID,
        privateKey: ALIPAY_PRIVATE_KEY,
        alipayPublicKey: ALIPAY_PUBLIC_KEY,
        gateway: ALIPAY_GATEWAY,
    });

    // 写入订单到数据库
    const { data: order, error: orderError } = await supabase
        .from('alipay_orders')
        .insert({
            subject,
            total_amount,
            order_type,
            order_data,
            user_id: userId,
            status: 'pending',
            qr_code: '',
        })
        .select()
        .single();

    if (orderError) {
        return NextResponse.json({
            success: false,
            message: orderError.message,
            data: '创建支付订单失败'
        });
    }

    // 预下单
    const result = alipaySdk.pageExec('alipay.trade.page.pay', {
        bizContent: {
            out_trade_no: order.id,
            total_amount: total_amount.toString(),
            subject,
            product_code: 'FAST_INSTANT_TRADE_PAY',
            qr_pay_mode: '0',
            qrcode_width: 600,
        },
    });

    if (!result) {
        await supabase
            .from('orders')
            .delete()
            .eq('id', order.id);
        return NextResponse.json({
            success: false,
            message: '无法创建订单',
            data: result
        });
    }


    if (orderError) {
        return NextResponse.json(
            { success: false, message: '订单写入失败', data: null },
            { status: 500 }
        );
    }

    // 返回响应
    return NextResponse.json<ApiData<CreateAlipayOrderResponseDto>>({
        success: true,
        message: '订单创建成功',
        data: {
            order: {
                id: order.id.toString(),
                out_trade_no: order.out_trade_no,
                subject: order.subject,
                total_amount: order.total_amount,
                status: order.status,
                created_at: order.created_at,
            },
            paymentInfo: {
                formHtml: result,
                description: '支付宝扫码支付',
            },
        },
    });
}
