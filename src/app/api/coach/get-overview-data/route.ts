import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: '未登录' }, { status: 401 });
    }

    // 1. 获取教练基础信息（可添加缓存逻辑）
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

    if (coachError || !coach) {
        return NextResponse.json({ success: false, message: '教练不存在' }, { status: 404 });
    }

    const coachId = coach.id;
    const now = new Date().toISOString();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // 2. 并行执行优化后的聚合查询
    const [statsResult, pendingReviewResult, ratingResult] = await Promise.all([
        // 优化点：一次性获取订阅人数和总月度收入
        supabase
            .from('coach_subscriptions')
            .select('monthly_price')
            .eq('coach_id', coachId)
            .eq('status', 'active')
            .lte('start_date', now), // 简化逻辑：当前已开始的活跃订阅

        // 优化点：使用 Supabase 的 filter 避免先查 ID 列表
        // 假设 training_videos 表有 coach_id 或可以通过关联查询
        supabase
            .from('training_videos')
            .select('*', { count: 'exact', head: true })
            .eq('coach_id', coachId)
            .eq('requires_review', true)
            .eq('review_status', 'pending')
            .is('deleted_at', null),

        // 优化点：评分查询
        supabase
            .from('student_comments')
            .select('rating')
            .eq('coach_id', coachId)
    ]);

    // 3. 内存处理聚合数据（比多次 DB 查询快得多）
    const subscriptions = statsResult.data || [];
    const totalStudentCount = subscriptions.length;
    const monthlyRevenue = subscriptions.reduce((sum, sub) => sum + (Number(sub.monthly_price) || 0), 0);
    
    const pendingReviewCount = pendingReviewResult.count || 0;

    const ratings = ratingResult.data || [];
    const averageRating = ratings.length > 0 
        ? parseFloat((ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length).toFixed(1)) 
        : 0;

    return NextResponse.json({
        success: true,
        data: {
            totalStudentCount,
            pendingReviewCount,
            averageRating,
            monthlyRevenue,
            recentActivity: '今日' // 建议：recentActivity 逻辑较重，可考虑异步懒加载或在 DB 层面用 union all 查询
        }
    });
}