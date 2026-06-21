import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { RemoveFromCartDto, RemoveFromCartResponseDto } from './entity';

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
    const { itemId } = await req.json() as RemoveFromCartDto;

    try {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', itemId)
            .eq('user_id', userId); // 确保只能删除自己的购物车项

        if (error) {
            console.error('删除购物车项失败:', error);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: error.message || '删除失败',
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<RemoveFromCartResponseDto>>({
            success: true,
            message: '已移除',
            data: {},
        });
    } catch (error: any) {
        console.error('删除购物车项异常:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '删除失败',
            data: null,
        }, { status: 500 });
    }
}
