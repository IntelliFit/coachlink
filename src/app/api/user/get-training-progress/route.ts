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

        const { user_id: userId, training_plan_id: trainingPlanId } = await request.json();

        // 验证用户ID
        if (!userId) {
            return NextResponse.json({
                success: false,
                message: '缺少用户ID',
                data: null
            }, { status: 400 });
        }

        // 以真实数据为准：training_plan_details + workout_logs
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

        // 2) 已完成天次和训练量、最近一次训练
        const { data: logs } = await supabase
            .from('workout_logs')
            .select('id, week_number, log_date, entries')
            .eq('user_id', userId)
            .eq('training_plan_id', trainingPlanId);

        const completedSessions = logs?.length || 0;
        const lastTrainingDate = logs && logs.length > 0
            ? logs.map((l: any) => l.log_date).sort().slice(-1)[0]
            : undefined;

        // 估算总训练量：对 entries 中的每个动作，取 load_actual*reps_completed 的和
        const parseReps = (val: any): number => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const m = val.match(/\d+/g);
                return m ? m.map(Number).reduce((a, b) => a + b, 0) : 0;
            }
            return 0;
        };
        const totalVolume = (logs || []).reduce((sum: number, log: any) => {
            const list = Array.isArray(log.entries) ? log.entries : [];
            const vol = list.reduce((s: number, e: any) => {
                const reps = parseReps(e?.reps_completed ?? e?.reps_planned ?? 0);
                const load = Number(e?.load_actual ?? e?.load_planned ?? 0) || 0;
                return s + reps * load;
            }, 0);
            return sum + vol;
        }, 0);

        // 3) 连续天数：从今天起向前检查连续有日志的天数
        const logSet = new Set((logs || []).map((l: any) => String(l.log_date)));
        let currentStreak = 0;
        const today = new Date();
        for (let i = 0; i < 30; i++) { // 最多回溯30天
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            if (logSet.has(key)) currentStreak++;
            else break;
        }

        const progressPercentage = totalSessions > 0
            ? Math.min(100, Math.round((completedSessions / totalSessions) * 100))
            : 0;

        const stats = {
            totalSessions,
            completedSessions,
            skippedSessions: Math.max(0, totalSessions - completedSessions),
            currentStreak,
            totalExercises,
            completedExercises: 0,
            totalVolume,
            avgRPE: 0,
            progressPercentage,
            lastTrainingDate,
        };

        return NextResponse.json({
            success: true,
            message: '获取训练进度成功',
            data: stats
        });
    } catch (error: any) {
        console.error('获取训练进度失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '获取训练进度失败',
            data: null
        }, { status: 500 });
    }
}