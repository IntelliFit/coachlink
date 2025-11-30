import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { CreatePaymentDto, CreatePaymentResponseDto } from './entity';

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

    const {
        amount,
        currency,
        orderId,
        description,
        returnUrl,
        cancelUrl
    } = await req.json() as CreatePaymentDto;

    // 模拟支付处理
    const paymentId = `pay_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    // 模拟重定向URL和二维码链接
    const redirectUrl = `/payment/process?paymentId=${paymentId}`;
    // 模拟二维码链接 (通常指向支付页面)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(redirectUrl)}`;

    // 模拟数据库保存支付订单
    console.log(`创建支付订单:`, {
        userId,
        paymentId,
        amount,
        currency,
        orderId,
        description
    });

    return NextResponse.json<ApiData<CreatePaymentResponseDto>>({
        success: true,
        message: '支付订单创建成功',
        data: {
            paymentId,
            status: 'pending',
            redirectUrl,
            qrCodeUrl
        }
    });
}