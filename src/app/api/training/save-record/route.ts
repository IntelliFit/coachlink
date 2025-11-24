import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { SaveTrainingRecordDto, SaveTrainingRecordResponseDto } from './entity';

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
        training_record_id,
        training_plan_id,
        week_number,
        day_number,
        training_date,
        exercises,
        status = 'in_progress',
        notes
    } = await req.json() as SaveTrainingRecordDto;

    if (!training_plan_id || !week_number || !day_number || !training_date || !exercises) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    try {
        // 计算统计数据
        let totalSets = 0;
        let completedSets = 0;
        let skippedSets = 0;

        exercises.forEach((exercise: any) => {
            exercise.sets.forEach((set: any) => {
                totalSets++;
                if (set.status === 'completed') completedSets++;
                if (set.status === 'skipped') skippedSets++;
            });
        });

        if (training_record_id && training_record_id !== 'preview') {
            // 更新现有记录
            const { data: updatedRecord, error: updateError } = await supabase
                .from('training_records')
                .update({
                    exercises: exercises as any,
                    total_sets: totalSets,
                    completed_sets: completedSets,
                    skipped_sets: skippedSets,
                    status: status,
                    notes: notes || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', training_record_id)
                .eq('user_id', userId)
                .select()
                .single();

            if (updateError) {
                console.error('更新训练记录失败:', updateError);
                throw updateError;
            }

            return NextResponse.json<ApiData<SaveTrainingRecordResponseDto>>({
                success: true,
                message: '保存训练记录成功',
                data: { record: updatedRecord as any }
            });
        } else {
            // 创建新记录
            // 先检查是否存在相同日期的记录
            const { data: existingRecord, error: checkError } = await supabase
                .from('training_records')
                .select('id, status')
                .eq('user_id', userId)
                .eq('plan_id', training_plan_id)
                .eq('training_date', training_date)
                .maybeSingle();

            if (checkError) {
                console.error('检查已有记录失败:', checkError);
                throw checkError;
            }

            if (existingRecord) {
                // 如果已完成，不允许覆盖
                if (existingRecord.status === 'completed') {
                    return NextResponse.json<ApiData<null>>({
                        success: false,
                        message: '今天已完成训练，无法覆盖',
                        data: null
                    }, { status: 400 });
                }

                // 更新已有记录
                // 构建更新对象：只有当记录不是 'in_progress' 状态时才更新 started_at
                const updateData: Record<string, any> = {
                    week_number: week_number,
                    day_number: day_number,
                    exercises: exercises as any,
                    total_sets: totalSets,
                    completed_sets: completedSets,
                    skipped_sets: skippedSets,
                    status: status,
                    notes: notes || null,
                    updated_at: new Date().toISOString()
                };

                // 只有当现有记录不是 'in_progress' 时，才设置新的 started_at
                if (existingRecord.status !== 'in_progress') {
                    updateData.started_at = new Date().toISOString();
                }

                const { data: updatedRecord, error: updateError } = await supabase
                    .from('training_records')
                    .update(updateData)
                    .eq('id', existingRecord.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('更新训练记录失败:', updateError);
                    throw updateError;
                }

                return NextResponse.json<ApiData<SaveTrainingRecordResponseDto>>({
                    success: true,
                    message: '保存训练记录成功',
                    data: { record: updatedRecord as any }
                });
            } else {
                // 插入新记录
                const { data: newRecord, error: insertError } = await supabase
                    .from('training_records')
                    .insert({
                        user_id: userId,
                        plan_id: training_plan_id,
                        training_date: training_date,
                        week_number: week_number,
                        day_number: day_number,
                        exercises: exercises as any,
                        total_sets: totalSets,
                        completed_sets: completedSets,
                        skipped_sets: skippedSets,
                        status: status,
                        notes: notes || null,
                        started_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('插入训练记录失败:', insertError);
                    throw insertError;
                }

                return NextResponse.json<ApiData<SaveTrainingRecordResponseDto>>({
                    success: true,
                    message: '创建训练记录成功',
                    data: { record: newRecord as any }
                });
            }
        }
    } catch (error: any) {
        console.error('保存训练记录失败:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '保存训练记录失败',
            data: null
        }, { status: 500 });
    }
}


