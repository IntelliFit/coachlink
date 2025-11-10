import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getSession } from 'next-auth/react';

export async function POST(req: Request) {
    try {
        const { coachId, viewerId, limit = 10, offset = 0, content_type, required_tier } = await req.json();

        if (!coachId) {
            return NextResponse.json({ message: '缺少教练ID' }, { status: 400 });
        }

        const session = await getSession();

        let effectiveViewerId = session?.user?.id ?? viewerId ?? null;
        let maxAccessTier = 0; // 默认只能查看免费内容

        // 验证教练存在
        const { data: coach, error: coachError } = await supabase
            .from('coaches')
            .select('id, user_id, name, status')
            .eq('id', coachId)
            .single();

        if (coachError || !coach) {
            return NextResponse.json({ message: '教练不存在' }, { status: 404 });
        }

        // 权限检查：判断是否是教练本人或其订阅者
        if (effectiveViewerId) {
            if (coach.user_id === effectiveViewerId) {
                // 教练本人
                maxAccessTier = 3;
            } else {
                const { data: subscription } = await supabase
                    .from('coach_subscriptions')
                    .select('tier, status')
                    .eq('coach_id', coachId)
                    .eq('student_id', effectiveViewerId)
                    .eq('status', 'active')
                    .single();

                if (subscription) {
                    maxAccessTier = subscription.tier;
                }
            }
        }

        // 构建查询
        let query = supabase
            .from('coach_contents')
            .select('*', { count: 'exact' })
            .eq('coach_id', coachId)
            .lte('required_tier', maxAccessTier)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // 可选过滤
        if (content_type) query = query.eq('content_type', content_type);
        if (required_tier !== undefined) query = query.eq('required_tier', required_tier);

        const { data: contents, error: contentsError, count } = await query;

        if (contentsError) {
            console.error('获取内容失败:', contentsError);
            return NextResponse.json({ message: '获取内容失败' }, { status: 500 });
        }

        return NextResponse.json({
            contents: contents || [],
            total: count || 0,
            limit,
            offset,
            coach: {
                id: coach.id,
                name: coach.name,
                status: coach.status
            },
            viewer_access_tier: maxAccessTier
        });
    } catch (error) {
        console.error('获取教练内容错误:', error);
        return NextResponse.json({ message: '服务器错误' }, { status: 500 });
    }
}
