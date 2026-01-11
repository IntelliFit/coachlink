import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { CoachesRow } from '@/types';
import type { GetContentByIdDto, GetContentByIdResponseDto } from './entity';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { ApiData } from '@/types/api';

async function getAccessTier(userId: string | null, coach: Partial<CoachesRow> | null) {
    if (userId && coach) {
        if (coach.user_id === userId) {
            // 教练本人，最高权限
            return 3;
        } else {
            // 获取订阅权限
            const { data: subscription } = await supabase
                .from('coach_subscriptions')
                .select('tier, status')
                .eq('coach_id', coach.id!)
                .eq('student_id', userId)
                .eq('status', 'active')
                .single();

            if (subscription) {
                return subscription.tier;
            }
        }
    }

    // 默认只能查看免费内容
    return 0;
}

export async function POST(req: Request) {
    const { contentId, viewerId } = await req.json() as GetContentByIdDto;

    if (!contentId) {
        return NextResponse.json({
            success: false,
            message: '缺少内容ID'
        }, { status: 400 });
    }

    // 获取内容详情
    const { data: content, error: contentError } = await supabase
        .from('coach_contents')
        .select(`
            *,
            coach:coaches(id, name, user_id)
        `)
        .eq('id', contentId)
        .single();

    if (contentError || !content) {
        console.error('获取内容失败:', contentError);
        return NextResponse.json({
            success: false,
            message: '内容不存在'
        }, { status: 404 });
    }

    const session = await getServerSession();
    const accessTier = await getAccessTier(
        session?.user.id || viewerId || null,
        content.coach
    );

    // 检查是否有权限访问此内容
    if (content.required_tier > accessTier) {
        return NextResponse.json({
            success: false,
            message: '无权限访问此内容'
        }, { status: 403 });
    }

    // 更新浏览次数
    await supabase
        .from('coach_contents')
        .update({ 
            views_count: (content.views_count || 0) + 1 
        })
        .eq('id', contentId);

    return NextResponse.json<ApiData<GetContentByIdResponseDto>>({
        success: true,
        message: '获取内容成功',
        data: {
            content,
            accessTier
        }
    });
}