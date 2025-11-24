import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabaseAdmin from '@/lib/supabaseAdmin';
import type { ApiData } from '@/types/api';
import type { MarkAsReadDto, MarkAsReadResponseDto } from './entity';

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
    const { conversation_id, message_ids } = await req.json() as MarkAsReadDto;

    if (!conversation_id) {
        return NextResponse.json({
            success: false,
            message: '缺少会话ID',
            data: null
        }, { status: 400 });
    }

    try {
        // 构建更新查询
        let query = supabaseAdmin
            .from('coach_messages')
            .update({ is_read: true })
            .eq('conversation_id', conversation_id)
            .eq('receiver_id', userId)
            .eq('is_read', false);

        if (message_ids && message_ids.length > 0) {
            query = query.in('id', message_ids);
        }

        const { count, error } = await query;

        if (error) {
            console.error('标记已读失败:', error);
            return NextResponse.json({
                success: false,
                message: '标记已读失败',
                data: null
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<MarkAsReadResponseDto>>({
            success: true,
            message: '标记已读成功',
            data: {
                marked_count: count || 0
            }
        });
    } catch (error: any) {
        console.error('标记已读错误:', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '服务器错误',
            data: null
        }, { status: 500 });
    }
}

