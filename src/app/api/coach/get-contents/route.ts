import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { CoachesRow } from '@/types';
import type { GetContentsDto, GetContentsResponseDto } from './entity';
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
    // viewerId 用于拓展游客阶段的访问
    const {
        coachId,
        viewerId,
        limit = 10,
        offset = 0,
        content_type,
        required_tier
    } = await req.json() as GetContentsDto;

    if (!coachId) {
        return NextResponse.json({ message: '缺少教练ID' }, { status: 400 });
    }

    const session = await getServerSession();
    // 兼容两种传参：
    // - coachId 为 coaches.id（学员端/教练主页）
    // - coachId 误传为 users.id（教练后台当前实现）
    //   这里做一次回退查询，避免前端传参不一致导致“教练不存在”
    let { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('*')
        .eq('id', coachId)
        .single();

    if (coachError || !coach) {
        const { data: coachByUserId, error: coachByUserError } = await supabase
            .from('coaches')
            .select('*')
            .eq('user_id', coachId)
            .single();

        if (coachByUserError || !coachByUserId) {
            return NextResponse.json({
                success: false,
                message: '教练不存在'
            });
        }

        coach = coachByUserId;
    }

    if (!coach) {
        return NextResponse.json({
            success: false,
            message: '教练不存在'
        });
    }

    const accessTier = await getAccessTier(
        session?.user.id || viewerId || null,
        coach
    );

    // 构建查询：返回该教练全部内容（与 get-aggregated-info.contentCount 口径一致）。
    // 未达到访问 tier 的行在下面统一脱敏 + 标记 is_locked。
    let query = supabase
        .from('coach_contents')
        .select('*', { count: 'exact' })
        .eq('coach_id', coach.id as string)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    // 可选过滤
    if (content_type) {
        query = query.eq('content_type', content_type);
    }

    if (required_tier !== undefined) {
        query = query.eq('required_tier', required_tier);
    }

    const { data: contents, error: contentsError, count } = await query;

    if (contentsError) {
        console.error('获取内容失败:', contentsError);
        return NextResponse.json({
            success: false,
            message: contentsError.message
        });
    }

    const sanitizedContents = (contents || []).map((row: any) => {
        const requiredTier = row?.required_tier ?? 0;
        if (requiredTier > accessTier) {
            const rawBody = typeof row.content === 'string' ? row.content : '';
            const plainPreview = rawBody
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 200);
            return {
                ...row,
                content: plainPreview,
                media_urls: [],
                is_locked: true
            };
        }
        return { ...row, is_locked: false };
    });

    return NextResponse.json<ApiData<GetContentsResponseDto>>({
        success: true,
        message: '获取内容成功',
        data: {
            contents: sanitizedContents,
            total: count || 0,
            limit,
            offset,
            coach: {
                id: coach.id,
                name: coach.name,
                status: coach.status
            },
            accessTier
        }
    });
}
