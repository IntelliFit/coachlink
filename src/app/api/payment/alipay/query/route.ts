import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import { AlipaySdk } from 'alipay-sdk';

import type { ApiData } from '@/types/api';
import type { QueryAlipayOrderDto, QueryAlipayOrderResponseDto } from './entity';

// 文档：https://opendocs.alipay.com/open/217dd591_alipay.trade.query?scene=common&pathHash=62ae74aa
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
        orderId
    } = await req.json() as QueryAlipayOrderDto;

    if (!orderId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '订单ID不能为空',
            data: null
        }, { status: 400 });
    }

    const alipaySdk = new AlipaySdk({
        appId: process.env.ALIPAY_APP_ID,
        privateKey: process.env.ALIPAY_PRIVATE_KEY,
        alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
        gateway: process.env.ALIPAY_GATEWAY
    });

    const response = await alipaySdk.exec('alipay.trade.query', {
        bizContent: {
            out_trade_no: orderId
        }
    });

    console.log(response);
    const result = response.alipay_trade_query_response;

    const status = result?.trade_status;

    // 支付成功
    const { data: order, error: orderError } = await supabase
        .from('alipay_orders')
        .update({
            status: status,
            alipay_trade_no: result?.trade_no
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
    
    return NextResponse.json({
        success: false,
        message: '支付状态',
        data: {
            status: status
        }
    });
}