import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { GetUserVideosDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const {
        userId: targetUserId,
        filters,
        pagination
    } = await req.json() as GetUserVideosDto;

    // 确定要查询的用户ID：如果传入了 userId，则查询该用户；否则查询当前登录用户
    const effectiveId = targetUserId || session.user.id;

    let query = supabase
        .from('training_videos')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .or(
            [
                `user_id.eq.${effectiveId}`,
                `metadata->>storage_folder.eq.${effectiveId}`,
                `video_url.ilike.%/${effectiveId}/%`
            ].join(',')
        );

    // 应用过滤器
    if (filters) {
        if (filters.type) {
            query = query.eq('type', filters.type);
        }
        if (filters.review_status) {
            query = query.eq('review_status', filters.review_status);
        }
        if (filters.training_plan_id) {
            query = query.eq('training_plan_id', filters.training_plan_id);
        }
        if (filters.exercise_name) {
            query = query.eq('exercise_name', filters.exercise_name);
        }
        if (filters.date_from) {
            query = query.gte('created_at', filters.date_from);
        }
        if (filters.date_to) {
            query = query.lte('created_at', filters.date_to);
        }
        if (filters.requires_review !== undefined) {
            query = query.eq('requires_review', filters.requires_review);
        }
    }

    // 分页
    if (pagination) {
        const from = (pagination.page - 1) * pagination.limit;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);
    }

    const { data, count, error } = await query.order('created_at', { ascending: false });

    if (error) {
        throw new Error(`获取视频列表失败: ${error.message}`);
    }

    return NextResponse.json({
        success: true,
        message: '获取用户视频成功',
        data: {
            videos: data || [],
            total: count || 0
        }
    });
}