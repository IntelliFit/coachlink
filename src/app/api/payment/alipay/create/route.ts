import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { CreateAlipayOrderDto, CreateAlipayOrderResponseDto } from './entity';
import { AlipaySdk } from 'alipay-sdk';

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
        out_trade_no,
        subject,
        total_amount,
        order_type,
        order_data,
    } = (await req.json()) as CreateAlipayOrderDto;

    if (!out_trade_no || !subject || !total_amount) {
        return NextResponse.json(
            { success: false, message: '缺少必要参数', data: null },
            { status: 400 }
        );
    }

    // 检查用户是否存在
    const { data: userCheck, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

    if (userCheckError || !userCheck) {
        return NextResponse.json(
            { success: false, message: '用户不存在', data: null },
            { status: 400 }
        );
    }

    // 读取支付宝配置
    const {
        ALIPAY_APP_ID,
        ALIPAY_PRIVATE_KEY,
        ALIPAY_PUBLIC_KEY,
        NEXTAUTH_URL,
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
        gateway: process.env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
        signType: 'RSA2',
        charset: 'utf-8',
        timeout: 5000,
    });

    // 预下单
    const result = await alipaySdk.exec('alipay.trade.precreate', {
        notify_url: `${NEXTAUTH_URL}/api/payment/alipay/notify`,
        bizContent: {
            out_trade_no,
            total_amount: total_amount.toString(),
            subject,
            product_code: 'FAST_INSTANT_TRADE_PAY',
            qr_pay_mode: '0',
            qrcode_width: 600,
        },
    });

    // 支付宝预下单返回 QR code
    const qrCode = result?.qr_code || '';

    // 写入订单到数据库
    const { data: order, error: orderError } = await supabase
        .from('alipay_orders')
        .insert({
            out_trade_no,
            subject,
            total_amount,
            order_type,
            order_data,
            user_id: userId,
            status: 'pending',
            qr_code: qrCode,
            alipay_trade_no: result?.trade_no || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

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
                payment_url: qrCode,
            },
            paymentInfo: {
                qrCode,
                description: '支付宝扫码支付',
                qrcodeWidth: '200',
                paymentMethod: 'alipay.trade.precreate',
            },
        },
    });
}
