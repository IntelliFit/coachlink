import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { GetWeeklyProgressDto, WeeklyProgress } from './entity';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const {
        training_plan_id: trainingPlanId,
        time_range: timeRange
    } = await request.json() as GetWeeklyProgressDto;

    const userId = session.user.id;

    if (!trainingPlanId) {
        return NextResponse.json({
            success: false,
            message: '缺少训练计划ID',
            data: null
        }, { status: 400 });
    }

    // 使用 training_records 表构建每周进度
    const { data: plan } = await supabase
        .from('training_plans')
        .select('duration_weeks')
        .eq('id', trainingPlanId)
        .single();
    const durationWeeks = plan?.duration_weeks || 6;

    // 计算每周计划的训练天数
    const { data: details } = await supabase
        .from('training_plan_details')
        .select('week_number')
        .eq('training_plan_id', trainingPlanId);
    const totalPerWeek: Record<number, number> = {};
    (details || []).forEach((d: any) => {
        totalPerWeek[d.week_number] = (totalPerWeek[d.week_number] || 0) + 1;
    });

    // 从 training_records 查询已完成的训练
    const { data: records } = await supabase
        .from('training_records')
        .select('week_number, status')
        .eq('user_id', userId)
        .eq('plan_id', trainingPlanId)
        .eq('status', 'completed');
    
    const completedPerWeek: Record<number, number> = {};
    (records || []).forEach((r: any) => {
        completedPerWeek[r.week_number] = (completedPerWeek[r.week_number] || 0) + 1;
    });

    const allWeeks: WeeklyProgress[] = [];
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
    const latestWeek = (records || []).reduce((m: number, r: any) => Math.max(m, r.week_number || 1), 1) || 1;
    let display: WeeklyProgress[] = allWeeks;
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
}

