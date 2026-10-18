import { NextResponse } from 'next/server';
import { getTrainingSetVolume } from '@coachlink/core/src/trainingSetMetrics';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { GetProgressStatsDto, GetProgressStatsResponseDto } from './entity';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;

    const { training_plan_id: trainingPlanId } = await request.json() as GetProgressStatsDto;

    if (!trainingPlanId) {
        return NextResponse.json({
            success: false,
            message: '缺少训练计划ID',
            data: null
        }, { status: 400 });
    }

    // 使用 training_records 表计算统计数据
    // 1) 计划总天次
    const { data: details } = await supabase
        .from('training_plan_details')
        .select('week_number, day_of_week, main_exercises, accessory_exercises')
        .eq('training_plan_id', trainingPlanId);

    const totalSessions = details?.length || 0;
    const totalExercises = (details || []).reduce((sum: number, d: any) => {
        const mainCount = Array.isArray(d?.main_exercises) ? d.main_exercises.length : 0;
        const accCount = Array.isArray(d?.accessory_exercises) ? d.accessory_exercises.length : 0;
        return sum + mainCount + accCount;
    }, 0);

    // 2) 从 training_records 表查询已完成的训练记录
    const { data: records } = await supabase
        .from('training_records')
        .select('id, week_number, day_number, training_date, exercises, total_sets, completed_sets, status, duration_minutes')
        .eq('user_id', userId)
        .eq('plan_id', trainingPlanId)
        .in('status', ['completed', 'in_progress'])
        .order('training_date', { ascending: false });

    const completedSessions = records?.filter((r: any) => r.status === 'completed').length || 0;
    const lastTrainingDate = records && records.length > 0
        ? records[0].training_date
        : undefined;

    // 计算总训练量：从 exercises 中提取所有已完成组的重量和次数
    const totalVolume = (records || []).reduce((sum: number, record: any) => {
        if (record.status !== 'completed') return sum;
        
        const exercises = Array.isArray(record.exercises) ? record.exercises : [];
        const vol = exercises.reduce((exSum: number, exercise: any) => {
            const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
            const setVol = sets.reduce((setSum: number, set: any) => {
                if (set.status !== 'completed') return setSum;
                
                return setSum + getTrainingSetVolume(set, exercise);
            }, 0);
            return exSum + setVol;
        }, 0);
        
        return sum + vol;
    }, 0);

    // 3) 连续天数：从今天起向前检查连续有已完成记录的天数
    const completedDates = new Set(
        (records || [])
            .filter((r: any) => r.status === 'completed')
            .map((r: any) => r.training_date)
    );
    
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) { // 最多回溯30天
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split('T')[0];
        if (completedDates.has(key)) {
            currentStreak++;
        } else if (i > 0) {
            // 如果不是今天，且没有记录，则中断连续
            break;
        }
    }

    const progressPercentage = totalSessions > 0
        ? Math.min(100, Math.round((completedSessions / totalSessions) * 100))
        : 0;

    const stats: GetProgressStatsResponseDto = {
        totalSessions,
        completedSessions,
        skippedSessions: Math.max(0, totalSessions - completedSessions),
        currentStreak,
        totalExercises,
        completedExercises: 0,
        totalVolume: Math.round(totalVolume),
        avgRPE: 0,
        progressPercentage,
        lastTrainingDate,
    };

    return NextResponse.json({
        success: true,
        message: '获取训练进度统计成功',
        data: stats
    });
}

