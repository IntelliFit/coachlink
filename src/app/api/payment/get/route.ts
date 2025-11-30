import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { GetPaymentDto, GetPaymentResponseDto } from './entity';

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
        paymentId
    } = await req.json() as GetPaymentDto;

    // 模拟从数据库获取支付订单信息
    // 在实际实现中，这里会查询数据库获取支付详情
    const amount = 99.99;
    const currency = 'CNY';
    const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const description = '教练服务订阅';
    const status: 'pending' | 'success' | 'failed' = 'pending';
    const createdAt = new Date().toISOString();
    
    // 模拟二维码链接
    const redirectUrl = `/payment/process?paymentId=${paymentId}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(redirectUrl)}`;

    // 模拟数据库查询
    console.log(`获取支付订单详情:`, {
        userId,
        paymentId
    });

    return NextResponse.json<ApiData<GetPaymentResponseDto>>({
        success: true,
        message: '支付订单详情获取成功',
        data: {
            paymentId,
            amount,
            currency,
            orderId,
            description,
            status,
            qrCodeUrl,
            createdAt
        }
    });
}