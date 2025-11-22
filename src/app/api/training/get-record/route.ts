import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetTrainingRecordDto, GetTrainingRecordResponseDto } from './entity';

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

    const {
        training_plan_id,
        week_number,
        day_number,
        training_date,
        read_only = false
    } = await req.json() as GetTrainingRecordDto;

    if (!training_plan_id || !week_number || !day_number) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    try {
        const targetDate = training_date || new Date().toISOString().split('T')[0];

        if (read_only) {
            // 只读模式：查询历史记录，不限制日期
            const { data: existingRecords, error: loadError } = await supabase
                .from('training_records')
                .select('*')
                .eq('user_id', userId)
                .eq('plan_id', training_plan_id)
                .eq('week_number', week_number)
                .eq('day_number', day_number)
                .order('training_date', { ascending: false })
                .limit(1);

            if (loadError) {
                console.error('查询训练记录失败:', loadError);
                throw loadError;
            }

            if (existingRecords && existingRecords.length > 0) {
                return NextResponse.json<ApiData<GetTrainingRecordResponseDto>>({
                    success: true,
                    message: '加载历史记录成功',
                    data: { record: existingRecords[0] as any }
                });
            }

            // 只读模式下没有找到记录，需要判断是过去还是未来
            // 计算当前周次
            const currentWeek = await calculateCurrentWeekNumber(userId, training_plan_id);
            
            // 判断日期类型
            let recordType: 'preview' | 'history' = 'preview';
            
            if (week_number < currentWeek) {
                // 过去的周 → 空白历史记录
                recordType = 'history';
            } else if (week_number > currentWeek) {
                // 未来的周 → 训练计划预览
                recordType = 'preview';
            } else {
                // 当前周，需要比较星期几
                const { data: planDetail } = await supabase
                    .from('training_plan_details')
                    .select('day_of_week')
                    .eq('training_plan_id', training_plan_id)
                    .eq('week_number', week_number)
                    .order('order_index', { ascending: true });
                
                if (planDetail && planDetail.length >= day_number) {
                    const targetDayOfWeek = planDetail[day_number - 1].day_of_week;
                    const today = new Date();
                    const beijingTime = new Date(today.getTime() + (8 * 60 * 60 * 1000));
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const todayDayOfWeek = days[beijingTime.getUTCDay()];
                    
                    const dayOrder: Record<string, number> = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
                    const todayOrder = dayOrder[todayDayOfWeek] || 1;
                    const targetOrder = dayOrder[targetDayOfWeek] || 1;
                    
                    if (targetOrder < todayOrder) {
                        // 当前周的过去日期 → 空白历史记录
                        recordType = 'history';
                    } else if (targetOrder > todayOrder) {
                        // 当前周的未来日期 → 训练计划预览
                        recordType = 'preview';
                    } else {
                        // 今天（理论上不应该走到这里，因为今天应该是 readOnly=false）
                        recordType = 'preview';
                    }
                }
            }
            
            const previewRecord = await generatePreviewRecord(
                userId,
                training_plan_id,
                week_number,
                day_number,
                targetDate,
                recordType
            );

            return NextResponse.json<ApiData<GetTrainingRecordResponseDto>>({
                success: true,
                message: recordType === 'history' ? '生成历史记录预览成功（无实际记录）' : '生成训练计划预览成功',
                data: { record: previewRecord }
            });
        } else {
            // 正常训练模式：查询今天的训练记录
            const { data: existingRecords, error: loadError } = await supabase
                .from('training_records')
                .select('*')
                .eq('user_id', userId)
                .eq('plan_id', training_plan_id)
                .eq('week_number', week_number)
                .eq('day_number', day_number)
                .eq('training_date', targetDate)
                .order('created_at', { ascending: false })
                .limit(1);

            if (loadError) {
                console.error('查询训练记录失败:', loadError);
                throw loadError;
            }

            if (existingRecords && existingRecords.length > 0) {
                return NextResponse.json<ApiData<GetTrainingRecordResponseDto>>({
                    success: true,
                    message: '加载训练记录成功',
                    data: { record: existingRecords[0] as any }
                });
            }

            // 没有找到记录，从训练计划生成预览（不保存）
            const previewRecord = await generatePreviewRecord(
                userId,
                training_plan_id,
                week_number,
                day_number,
                targetDate,
                'preview' // 标记为训练计划预览
            );

            return NextResponse.json<ApiData<GetTrainingRecordResponseDto>>({
                success: true,
                message: '生成训练计划预览成功',
                data: { record: previewRecord }
            });
        }
    } catch (error: any) {
        console.error('获取训练记录失败:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '获取训练记录失败',
            data: null
        }, { status: 500 });
    }
}

// 计算当前是第几周（根据第一次训练记录或今天的日期计算）
async function calculateCurrentWeekNumber(userId: string, trainingPlanId: string): Promise<number> {
    try {
        const { data, error } = await supabase
            .from('training_records')
            .select('training_date')
            .eq('user_id', userId)
            .eq('plan_id', trainingPlanId)
            .order('training_date', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (!error && data) {
            const firstTrainingDate = new Date(data.training_date);
            const today = new Date();
            const daysDiff = Math.floor((today.getTime() - firstTrainingDate.getTime()) / (1000 * 60 * 60 * 24));
            const weekNumber = Math.floor(daysDiff / 7) + 1;
            return Math.max(1, weekNumber);
        }
    } catch (error) {
        console.error('获取当前周次失败:', error);
    }
    return 1;
}

// 从训练计划生成预览记录（不保存到数据库）
async function generatePreviewRecord(
    userId: string,
    planId: string,
    weekNumber: number,
    dayNumber: number,
    trainingDate: string,
    recordType: 'preview' | 'history' = 'preview'
): Promise<any> {
    // 加载训练计划详情
    const { data: planDetails, error: planError } = await supabase
        .from('training_plan_details')
        .select('main_exercises, accessory_exercises, warmup, cooldown, session_focus, day_of_week, order_index, notes')
        .eq('training_plan_id', planId)
        .eq('week_number', weekNumber)
        .order('order_index', { ascending: true });

    if (planError) {
        throw planError;
    }

    if (!planDetails || planDetails.length === 0) {
        throw new Error(`第 ${weekNumber} 周没有训练计划`);
    }

    // 根据 dayNumber 选择对应的训练计划（dayNumber 从 1 开始）
    const targetDayIndex = dayNumber - 1;
    if (targetDayIndex < 0 || targetDayIndex >= planDetails.length) {
        throw new Error(`第 ${weekNumber} 周的训练计划只有 ${planDetails.length} 个训练日，无法访问第 ${dayNumber} 天`);
    }

    const dayDetail = planDetails[targetDayIndex];

    // 合并所有训练动作：热身 + 主项 + 辅项 + 放松
    const warmupExercises = Array.isArray(dayDetail.warmup) ? dayDetail.warmup : [];
    const mainExercises = Array.isArray(dayDetail.main_exercises) ? dayDetail.main_exercises : [];
    const accessoryExercises = Array.isArray(dayDetail.accessory_exercises) ? dayDetail.accessory_exercises : [];
    const cooldownExercises = Array.isArray(dayDetail.cooldown) ? dayDetail.cooldown : [];
    const allExercises = [...warmupExercises, ...mainExercises, ...accessoryExercises, ...cooldownExercises];

    if (allExercises.length === 0) {
        throw new Error('训练计划中没有动作');
    }

    // 转换为 ExerciseRecord 格式
    const exerciseRecords: any[] = allExercises.map((ex: any, globalIndex: number) => {
        let category = 'accessory';
        if (globalIndex < warmupExercises.length) {
            category = 'warmup';
        } else if (globalIndex < warmupExercises.length + mainExercises.length) {
            category = 'main';
        } else if (globalIndex >= allExercises.length - cooldownExercises.length) {
            category = 'cooldown';
        }

        return {
            exercise_index: globalIndex,
            exercise_name: ex.name || ex.exercise_name || '未命名动作',
            exercise_category: ex.category || category,
            sets: Array.from({ length: ex.sets || 5 }, (_, setIndex) => ({
                set_index: setIndex,
                planned_weight: ex.load_value || ex.weight || undefined,
                planned_reps: ex.reps || '5',
                planned_rest_seconds: ex.rest_sec || ex.rest_time || (category === 'warmup' || category === 'cooldown' ? 60 : 180),
                status: 'pending' as const,
                is_pr: false,
                is_breakthrough: false
            })),
            notes: ex.notes || ''
        };
    });

    const total_sets = exerciseRecords.reduce((sum: number, ex: any) => sum + ex.sets.length, 0);

    // 返回预览记录（使用虚拟ID，不保存到数据库）
    // recordType 为 'history' 时表示空白历史记录，为 'preview' 时表示未来的训练计划
    return {
        id: recordType === 'history' ? 'empty-history' : 'preview',
        user_id: userId,
        plan_id: planId,
        training_date: trainingDate,
        week_number: weekNumber,
        day_number: dayNumber,
        exercises: exerciseRecords,
        total_sets: total_sets,
        completed_sets: 0,
        skipped_sets: 0,
        status: 'in_progress' as const,
        notes: dayDetail.notes || undefined,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}


