import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { VerifyPaymentDto, VerifyPaymentResponseDto } from '../entity';

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
        paymentId,
        transactionId
    } = await req.json() as VerifyPaymentDto;

    // 模拟支付验证过程
    // 在实际实现中，这里会调用第三方支付平台API进行验证
    
    // 模拟验证结果
    const isVerified = Math.random() > 0.2; // 80%的成功率
    
    if (!isVerified) {
        return NextResponse.json<ApiData<VerifyPaymentResponseDto>>({
            success: false,
            message: '支付验证失败',
            data: null
        });
    }

    // 模拟支付完成时间
    const paidAt = new Date().toISOString();

    // 模拟从数据库获取支付信息
    const amount = 99.99;
    const currency = 'CNY';

    // 模拟更新数据库中的支付状态
    console.log(`支付验证成功:`, {
        userId,
        paymentId,
        transactionId,
        amount,
        currency,
        paidAt
    });

    return NextResponse.json<ApiData<VerifyPaymentResponseDto>>({
        success: true,
        message: '支付验证成功',
        data: {
            paymentId,
            status: 'completed',
            transactionId,
            amount,
            currency,
            paidAt
        }
    });
}