import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetHubDataDto, GetHubDataResponseDto, TrainingRecord, WeekDay } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;

    const { training_plan_id } = await req.json() as GetHubDataDto;

    if (!training_plan_id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    try {
        // 1. 计算当前周次
        const currentWeek = await calculateCurrentWeekNumber(userId, training_plan_id);

        // 2. 加载今天所在周的训练日
        const todayWeekDays = await loadWeekDays(training_plan_id, currentWeek);

        // 3. 检查今日训练记录
        const todayRecord = await checkTodayRecord(userId, training_plan_id);

        // 4. 加载训练计划基本信息
        const trainingPlan = await loadTrainingPlan(training_plan_id);

        const response: GetHubDataResponseDto = {
            current_week: currentWeek,
            today_record: todayRecord,
            today_week_days: todayWeekDays,
            training_plan: trainingPlan
        };

        return NextResponse.json<ApiData<GetHubDataResponseDto>>({
            success: true,
            message: '获取训练中心数据成功',
            data: response
        });
    } catch (error: any) {
        console.error('获取训练中心数据失败:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '获取训练中心数据失败',
            data: null
        }, { status: 500 });
    }
}

// 计算当前是第几周（根据第一次训练记录或今天的日期计算）
async function calculateCurrentWeekNumber(userId: string, trainingPlanId: string): Promise<number> {
    try {
        // 查找该计划的第一条训练记录
        const { data, error } = await supabase
            .from('training_records')
            .select('training_date')
            .eq('user_id', userId)
            .eq('plan_id', trainingPlanId)
            .order('training_date', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (!error && data) {
            // 如果有训练记录，计算从第一次训练到现在过了多少周
            const firstTrainingDate = new Date(data.training_date);
            const today = new Date();
            const daysDiff = Math.floor((today.getTime() - firstTrainingDate.getTime()) / (1000 * 60 * 60 * 24));
            const weekNumber = Math.floor(daysDiff / 7) + 1;
            return Math.max(1, weekNumber);
        }
    } catch (error) {
        console.error('获取当前周次失败:', error);
    }
    
    // 如果没有训练记录，默认返回第1周
    return 1;
}

// 加载指定周的训练日
async function loadWeekDays(trainingPlanId: string, weekNumber: number): Promise<WeekDay[]> {
    try {
        const { data, error } = await supabase
            .from('training_plan_details')
            .select('day_of_week, session_focus, order_index')
            .eq('training_plan_id', trainingPlanId)
            .eq('week_number', weekNumber)
            .order('order_index', { ascending: true });

        if (error) throw error;
        
        return data || [];
    } catch (error) {
        console.error('加载训练日失败:', error);
        return [];
    }
}

// 检查今日是否有训练记录
async function checkTodayRecord(userId: string, trainingPlanId: string): Promise<TrainingRecord | null> {
    try {
        const todayDate = new Date().toISOString().split('T')[0];
        
        // 优先查询今天日期的最新记录（无论 week/day）
        const { data, error } = await supabase
            .from('training_records')
            .select('id, week_number, day_number, completed_sets, total_sets, status, training_date')
            .eq('user_id', userId)
            .eq('plan_id', trainingPlanId)
            .eq('training_date', todayDate)
            .in('status', ['in_progress', 'completed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (!error && data) {
            return data as TrainingRecord;
        }
        
        return null;
    } catch (error) {
        console.error('检查今日训练记录失败:', error);
        return null;
    }
}

// 加载训练计划基本信息
async function loadTrainingPlan(trainingPlanId: string) {
    try {
        const { data, error } = await supabase
            .from('training_plans')
            .select('*')
            .eq('id', trainingPlanId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('加载训练计划失败:', error);
        return null;
    }
}





