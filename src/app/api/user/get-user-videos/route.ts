import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                message: '用户未登录',
                data: null
            }, { status: 401 });
        }

        const { userId, filters, pagination } = await request.json();

        // 验证用户ID
        if (!userId) {
            return NextResponse.json({
                success: false,
                message: '缺少用户ID',
                data: null
            }, { status: 400 });
        }

        // 优先用 auth.uid，否则使用传入的 userId；并支持通过 metadata.storage_folder 或 URL 路径匹配
        let effectiveId: string | null = null;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            effectiveId = user?.id ?? null;
        } catch { }
        if (!effectiveId) effectiveId = userId;

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
    } catch (error: any) {
        console.error('获取用户视频失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '获取用户视频失败',
            data: null
        }, { status: 500 });
    }
}