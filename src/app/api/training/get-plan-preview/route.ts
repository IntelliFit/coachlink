import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { 
    GetPlanPreviewDto, 
    GetPlanPreviewResponseDto, 
    PlanPreview, 
    WeekPreview,
    SessionPreview,
    ExercisePreview 
} from './entity';

/**
 * POST /api/training/get-plan-preview
 * 获取训练计划的预览数据
 * 
 * 从 training_plan_details 构建周期化训练计划的预览
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { training_plan_id } = await req.json() as GetPlanPreviewDto;

    if (!training_plan_id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '缺少训练计划ID',
            data: null
        }, { status: 400 });
    }

    try {
        // 1. 加载训练计划基本信息
        const { data: planData, error: planError } = await supabase
            .from('training_plans')
            .select('id, title, description, duration_weeks, difficulty_level, created_at')
            .eq('id', training_plan_id)
            .single();

        if (planError) {
            console.error('查询训练计划失败:', planError);
            throw new Error('训练计划不存在');
        }

        // 2. 加载训练计划详情
        const { data: details, error: detailsError } = await supabase
            .from('training_plan_details')
            .select('*')
            .eq('training_plan_id', training_plan_id)
            .order('week_number', { ascending: true })
            .order('order_index', { ascending: true });

        if (detailsError) {
            console.error('查询训练计划详情失败:', detailsError);
            throw new Error('无法加载训练计划详情');
        }

        if (!details || details.length === 0) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: '训练计划没有详细内容',
                data: null
            }, { status: 404 });
        }

        // 3. 构建预览数据结构
        const preview = buildPreviewData(planData, details);

        return NextResponse.json<ApiData<PlanPreview>>({
            success: true,
            message: '获取训练计划预览成功',
            data: preview
        });

    } catch (error: any) {
        console.error('获取训练计划预览失败:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '获取训练计划预览失败',
            data: null
        }, { status: 500 });
    }
}

/**
 * 构建训练计划预览数据
 */
function buildPreviewData(planData: any, details: any[]): PlanPreview {
    // 按周分组
    const weekMap = new Map<number, any[]>();
    details.forEach(detail => {
        const weekNum = detail.week_number;
        if (!weekMap.has(weekNum)) {
            weekMap.set(weekNum, []);
        }
        weekMap.get(weekNum)!.push(detail);
    });

    // 构建周数据
    const weeks: WeekPreview[] = [];
    weekMap.forEach((weekDetails, weekNumber) => {
        const sessions: SessionPreview[] = weekDetails.map(detail => {
            // 处理主项训练
            const mainExercises: ExercisePreview[] = Array.isArray(detail.main_exercises)
                ? detail.main_exercises.map((ex: any) => ({
                    name: ex.name || ex.exercise_name || '未命名动作',
                    sets: ex.sets || 3,
                    reps: ex.reps || 5,
                    load_type: ex.load_type,
                    load_value: ex.load_value || ex.weight,
                    rest_sec: ex.rest_sec || ex.rest_time || 180,
                    notes: ex.notes
                }))
                : [];

            // 处理辅助训练
            const accessoryExercises: ExercisePreview[] = Array.isArray(detail.accessory_exercises)
                ? detail.accessory_exercises.map((ex: any) => ({
                    name: ex.name || ex.exercise_name || '未命名动作',
                    sets: ex.sets || 3,
                    reps: ex.reps || 10,
                    load_type: ex.load_type,
                    load_value: ex.load_value || ex.weight,
                    rest_sec: ex.rest_sec || ex.rest_time || 90,
                    notes: ex.notes
                }))
                : [];

            return {
                day: detail.day_of_week || 'Mon',
                focus: detail.session_focus || '综合训练',
                main: mainExercises,
                accessories: accessoryExercises,
                notes: detail.notes
            };
        });

        weeks.push({
            week: weekNumber,
            sessions
        });
    });

    // 按周次排序
    weeks.sort((a, b) => a.week - b.week);

    // 计算每周训练频率
    const frequencyPerWeek = weeks.length > 0 
        ? Math.round(weeks.reduce((sum, w) => sum + w.sessions.length, 0) / weeks.length)
        : 0;

    return {
        meta: {
            title: planData.title || '训练计划',
            description: planData.description,
            duration_weeks: planData.duration_weeks || weeks.length,
            frequency_per_week: frequencyPerWeek,
            experience_level: planData.difficulty_level || 'intermediate'
        },
        weeks
    };
}




