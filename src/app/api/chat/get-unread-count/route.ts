import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetUnreadCountDto, GetUnreadCountResponseDto } from './entity';

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

    try {
        // 判断是教练还是学员
        const { data: coachData } = await supabase
            .from('coaches')
            .select('id')
            .eq('user_id', userId)
            .single();

        const isCoach = !!coachData;

        // 查询未读数
        const { data: chat_rooms, error } = await supabase
            .from('chat_rooms' as any)
            .select(isCoach ? 'coach_unread' : 'student_unread')
            .eq(isCoach ? 'coach_id' : 'student_id', isCoach ? coachData.id : userId)
            .eq('is_archived', false) as any;

        if (error) {
            console.error('查询未读数失败:', error);
            return NextResponse.json({
                success: false,
                message: '获取未读数失败',
                data: null
            }, { status: 500 });
        }

        const totalUnread = chat_rooms?.reduce((sum, conv) => {
            return sum + (isCoach ? (conv.coach_unread || 0) : (conv.student_unread || 0));
        }, 0) || 0;

        const conversationsWithUnread = chat_rooms?.filter(conv => {
            return (isCoach ? (conv.coach_unread || 0) : (conv.student_unread || 0)) > 0;
        }).length || 0;

        return NextResponse.json<ApiData<GetUnreadCountResponseDto>>({
            success: true,
            message: '获取未读数成功',
            data: {
                total_unread: totalUnread,
                conversations_with_unread: conversationsWithUnread
            }
        });
    } catch (error: any) {
        console.error('获取未读数错误:', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '服务器错误',
            data: null
        }, { status: 500 });
    }
}

