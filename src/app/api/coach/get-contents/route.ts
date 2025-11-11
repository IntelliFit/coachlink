import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { CoachesRow } from '@/types';
import type { GetContentsDto } from './entity';
import { getServerSession } from '../../auth/[...nextauth]/auth';

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
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id, user_id, name, status')
        .eq('user_id', coachId)
        .single();

    if (coachError || !coach) {
        return NextResponse.json({
            success: false,
            message: '教练不存在'
        });
    }

    const accessTier = await getAccessTier(
        session?.user.id || viewerId || null,
        coach
    );

    // 构建查询
    let query = supabase
        .from('coach_contents')
        .select('*', { count: 'exact' })
        .eq('coach_id', coachId)
        .lte('required_tier', accessTier)
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

    return NextResponse.json({
        success: true,
        message: '获取内容成功',
        data: {
            contents: contents || [],
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
