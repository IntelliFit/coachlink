import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetCartItemsResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '用户未登录',
            data: null,
        }, { status: 401 });
    }

    const userId = authResult.userId;

    try {
        const { data, error } = await supabase
            .from('cart_items')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('获取购物车失败:', error);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: error.message || '获取购物车失败',
                data: null,
            }, { status: 500 });
        }

        const items = (data || []).map(item => ({
            id: item.id,
            coachId: item.coach_id,
            coachName: item.coach_name,
            productId: item.product_id,
            productName: item.product_name,
            productTier: item.product_tier as 'basic' | 'standard' | 'vip',
            durationMonths: item.duration_months,
            price: Number(item.price),
            createdAt: item.created_at,
            updatedAt: item.updated_at,
        }));

        return NextResponse.json<ApiData<GetCartItemsResponseDto>>({
            success: true,
            message: '获取成功',
            data: {
                items,
                total: items.length,
            },
        });
    } catch (error: any) {
        console.error('获取购物车异常:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '获取购物车失败',
            data: null,
        }, { status: 500 });
    }
}
