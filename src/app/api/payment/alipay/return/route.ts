import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const params = Object.fromEntries(url.searchParams);
        
        // 提取关键参数
        const {
            out_trade_no,  // 商户订单号
            trade_no,      // 支付宝交易号
            total_amount   // 交易金额
        } = params;
        
        // 验证必要参数
        if (!out_trade_no || !trade_no) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: '回调参数错误，缺少必要参数',
                data: null
            }, { status: 400 });
        }
        
        // 更新订单状态
        const { data, error } = await supabase
            .from('alipay_orders')
            .update({
                status: 'paid',
                trade_no: trade_no,
                paid_at: new Date().toISOString()
            })
            .eq('out_trade_no', out_trade_no)
            .select();
        
        if (error) {
            console.error('更新订单状态失败:', error);
        }
        
        // 重定向回应用的支付成功页面
        const redirectUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment/${out_trade_no}`;
        
        return NextResponse.redirect(redirectUrl);
        
    } catch (error) {
        console.error('支付回调处理失败:', error);
        
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '回调处理失败',
            data: null
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        let params: any = {};
        
        const contentType = req.headers.get('content-type') || '';
        
        if (contentType.includes('application/x-www-form-urlencoded')) {
            // 表单数据
            const body = await req.text();
            params = Object.fromEntries(new URLSearchParams(body));
        } else if (contentType.includes('application/json')) {
            // JSON 数据
            params = await req.json();
        }
        
        // 提取关键参数
        const {
            out_trade_no,  // 商户订单号
            trade_no,      // 支付宝交易号
            total_amount   // 交易金额
        } = params;
        
        // 验证必要参数
        if (!out_trade_no || !trade_no) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: '回调参数错误，缺少必要参数',
                data: null
            }, { status: 400 });
        }
        
        // 更新订单状态
        const { data, error } = await supabase
            .from('alipay_orders')
            .update({
                status: 'paid',
                trade_no: trade_no,
                paid_at: new Date().toISOString()
            })
            .eq('out_trade_no', out_trade_no)
            .select();
        
        if (error) {
            console.error('更新订单状态失败:', error);
        }
        
        // 重定向回应用的支付成功页面
        const redirectUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment/${out_trade_no}`;
        
        return NextResponse.redirect(redirectUrl);
        
    } catch (error) {
        console.error('支付回调处理失败:', error);
        
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '回调处理失败',
            data: null
        }, { status: 500 });
    }
}