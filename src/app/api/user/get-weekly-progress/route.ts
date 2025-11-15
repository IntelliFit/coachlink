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

        const { user_id: userId, training_plan_id: trainingPlanId, time_range: timeRange } = await request.json();

        // 验证必要参数
        if (!userId) {
            return NextResponse.json({
                success: false,
                message: '缺少用户ID',
                data: null
            }, { status: 400 });
        }

        // 以计划明细和日志聚合构建每周进度
        const { data: plan } = await supabase
            .from('training_plans')
            .select('duration_weeks')
            .eq('id', trainingPlanId)
            .single();
        const durationWeeks = plan?.duration_weeks || 6;

        const { data: details } = await supabase
            .from('training_plan_details')
            .select('week_number')
            .eq('training_plan_id', trainingPlanId);
        const totalPerWeek: Record<number, number> = {};
        (details || []).forEach((d: any) => {
            totalPerWeek[d.week_number] = (totalPerWeek[d.week_number] || 0) + 1;
        });

        const { data: logs } = await supabase
            .from('workout_logs')
            .select('week_number')
            .eq('user_id', userId)
            .eq('training_plan_id', trainingPlanId);
        const completedPerWeek: Record<number, number> = {};
        (logs || []).forEach((l: any) => {
            completedPerWeek[l.week_number] = (completedPerWeek[l.week_number] || 0) + 1;
        });

        const allWeeks: any[] = [];
        for (let w = 1; w <= durationWeeks; w++) {
            const total = totalPerWeek[w] || 0;
            const completed = Math.min(total, completedPerWeek[w] || 0);
            allWeeks.push({
                week: w,
                completed,
                total,
                percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            });
        }

        // 根据选择范围筛选显示
        const latestWeek = (logs || []).reduce((m: number, l: any) => Math.max(m, l.week_number || 1), 1) || 1;
        let display: any[] = allWeeks;
        if (timeRange === 'week') {
            display = allWeeks.filter(w => w.week === latestWeek);
        } else if (timeRange === 'month') {
            const start = Math.max(1, latestWeek);
            const end = Math.min(durationWeeks, start + 3);
            display = allWeeks.filter(w => w.week >= start && w.week <= end);
        }

        return NextResponse.json({
            success: true,
            message: '获取周进度成功',
            data: {
                weeklyProgress: display
            }
        });
    } catch (error: any) {
        console.error('获取周进度失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '获取周进度失败',
            data: null
        }, { status: 500 });
    }
}