import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { GetBreakthroughsDto, GetBreakthroughsResponseDto, BreakthroughRecord } from './entity';

/**
 * POST /api/training/get-breakthroughs
 * 获取训练进步记录（Breakthroughs）
 * 
 * 只返回主项(main)和副项(accessory)的进步组数据
 */
export async function POST(request: NextRequest) {
    try {
        // 验证用户会话
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: '未授权访问'
                } as GetBreakthroughsResponseDto,
                { status: 401 }
            );
        }

        const body: GetBreakthroughsDto = await request.json();
        const { training_plan_id, user_id } = body;

        // 如果没有提供 user_id，使用当前登录用户的 ID
        const targetUserId = user_id || session.user.id;

        if (!training_plan_id) {
            return NextResponse.json(
                {
                    success: false,
                    message: '缺少必要参数：training_plan_id'
                } as GetBreakthroughsResponseDto,
                { status: 400 }
            );
        }

        // 计算估算1RM (使用 Brzycki 公式)
        const calculate1RM = (weight: number, reps: number): number => {
            if (reps === 1) return weight;
            return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
        };

        // 从 training_records 获取所有进步组记录（只获取主项和副项）
        const { data: records, error: recordsError } = await supabase
            .from('training_records')
            .select('training_date, week_number, day_number, exercises')
            .eq('user_id', targetUserId)
            .eq('plan_id', training_plan_id)
            .order('training_date', { ascending: true });

        if (recordsError) {
            console.error('查询训练记录失败:', recordsError);
            return NextResponse.json(
                {
                    success: false,
                    message: '查询训练记录失败'
                } as GetBreakthroughsResponseDto,
                { status: 500 }
            );
        }

        // 提取所有进步组（只包括主项和副项）
        const breakthroughList: BreakthroughRecord[] = [];
        const exerciseSet = new Set<string>();

        records?.forEach((record: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const exercises = record.exercises as any[];
            exercises?.forEach(exercise => {
                // 只处理主项(main)和副项(accessory)
                const category = exercise.exercise_category;
                if (category !== 'main' && category !== 'accessory') {
                    return;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                exercise.sets?.forEach((set: any) => {
                    if (set.is_breakthrough && set.status === 'completed') {
                        const weight = set.actual_weight || 0;
                        const reps = set.actual_reps || 0;

                        breakthroughList.push({
                            date: record.training_date,
                            exercise_name: exercise.exercise_name,
                            exercise_category: category,
                            weight,
                            reps,
                            estimated_1rm: calculate1RM(weight, reps),
                            week_number: record.week_number,
                            day_number: record.day_number
                        });

                        exerciseSet.add(exercise.exercise_name);
                    }
                });
            });
        });

        return NextResponse.json({
            success: true,
            data: {
                breakthroughs: breakthroughList,
                totalCount: breakthroughList.length,
                exerciseCount: exerciseSet.size
            }
        } as GetBreakthroughsResponseDto);

    } catch (error) {
        console.error('获取进步记录失败:', error);
        return NextResponse.json(
            {
                success: false,
                message: '服务器内部错误'
            } as GetBreakthroughsResponseDto,
            { status: 500 }
        );
    }
}

