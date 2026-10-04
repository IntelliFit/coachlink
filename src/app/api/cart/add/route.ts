import { NextResponse } from 'next/server';
import { rejectWechatCoachPurchase } from '@/lib/wechatFreeRelease';
import { getApiUserId } from '@/lib/getApiUserId';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { AddToCartDto, AddToCartResponseDto } from './entity';

export async function POST(req: Request) {
    const paused = rejectWechatCoachPurchase(req);
    if (paused) return paused;
    const userId = await getApiUserId(req);
    if (!userId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '用户未登录',
            data: null,
        }, { status: 401 });
    }

    const body = await req.json() as AddToCartDto;

    try {
        // 使用 upsert 来处理重复项（如果已存在则更新，否则插入）
        const { data, error } = await supabase
            .from('cart_items')
            .upsert({
                user_id: userId,
                coach_id: body.coachId,
                coach_name: body.coachName,
                product_id: body.productId,
                product_name: body.productName,
                product_tier: body.productTier,
                duration_months: body.durationMonths,
                price: body.price,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,coach_id,product_id,duration_months',
            })
            .select()
            .single();

        if (error) {
            console.error('添加购物车失败:', error);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: error.message || '添加购物车失败',
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<AddToCartResponseDto>>({
            success: true,
            message: '已加入购物车',
            data: {
                item: {
                    id: data.id,
                    coachId: data.coach_id,
                    coachName: data.coach_name,
                    productId: data.product_id,
                    productName: data.product_name,
                    productTier: data.product_tier as 'basic' | 'standard' | 'vip',
                    durationMonths: data.duration_months,
                    price: Number(data.price),
                    createdAt: data.created_at,
                },
            },
        });
    } catch (error: any) {
        console.error('添加购物车异常:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '添加购物车失败',
            data: null,
        }, { status: 500 });
    }
}
