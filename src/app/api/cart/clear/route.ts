import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { ClearCartResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '用户未登录',
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error('清空购物车失败:', error);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: error.message || '清空失败',
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<ClearCartResponseDto>>({
            success: true,
            message: '已清空',
            data: {},
        });
    } catch (error: any) {
        console.error('清空购物车异常:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '清空失败',
            data: null,
        }, { status: 500 });
    }
}
