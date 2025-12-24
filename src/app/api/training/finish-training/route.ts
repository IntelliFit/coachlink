import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { FinishTrainingDto, FinishTrainingResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;

    const {
        training_record_id,
        notes
    } = await req.json() as FinishTrainingDto;

    if (!training_record_id || training_record_id === 'preview') {
        return NextResponse.json({
            success: false,
            message: '无效的训练记录ID',
            data: null
        }, { status: 400 });
    }

    try {
        // 获取当前记录
        const { data: currentRecord, error: fetchError } = await supabase
            .from('training_records')
            .select('*')
            .eq('id', training_record_id)
            .eq('user_id', userId)
            .single();

        if (fetchError || !currentRecord) {
            return NextResponse.json({
                success: false,
                message: '训练记录不存在',
                data: null
            }, { status: 404 });
        }

        // 计算训练时长
        const startedAt = currentRecord.started_at ? new Date(currentRecord.started_at) : new Date();
        const now = new Date();
        const durationMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000);

        // 更新记录为完成状态
        const { data: updatedRecord, error: updateError } = await supabase
            .from('training_records')
            .update({
                status: 'completed',
                completed_at: now.toISOString(),
                duration_minutes: durationMinutes,
                notes: notes || currentRecord.notes || null,
                updated_at: now.toISOString()
            })
            .eq('id', training_record_id)
            .select()
            .single();

        if (updateError) {
            console.error('完成训练失败:', updateError);
            throw updateError;
        }

        // 更新个人记录（从 exercises 中提取数据）
        if (currentRecord.exercises && Array.isArray(currentRecord.exercises)) {
            const exercisesToUpdate: any[] = [];
            currentRecord.exercises.forEach((exercise: any) => {
                if (exercise.sets && Array.isArray(exercise.sets)) {
                    exercise.sets.forEach((set: any) => {
                        if (set.status === 'completed' && set.actual_weight && set.actual_reps) {
                            exercisesToUpdate.push({
                                name: exercise.exercise_name,
                                weight: set.actual_weight,
                                reps: set.actual_reps,
                                week_number: currentRecord.week_number,
                                day_of_week: currentRecord.day_number
                            });
                        }
                    });
                }
            });

            if (exercisesToUpdate.length > 0) {
                // 调用更新个人记录的 API（内部调用，不通过 HTTP）
                for (const exercise of exercisesToUpdate) {
                    if (exercise.weight && exercise.reps) {
                        const { data: existingRecord } = await supabase
                            .from('personal_records')
                            .select('*')
                            .eq('user_id', userId)
                            .eq('exercise_name', exercise.name)
                            .order('max_weight', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        // 只有当新纪录的重量大于旧纪录时才更新
                        if (!existingRecord || (existingRecord.max_weight && exercise.weight > existingRecord.max_weight)) {
                            await supabase.from('personal_records').upsert({
                                user_id: userId,
                                exercise_name: exercise.name,
                                max_weight: exercise.weight,
                                max_reps: exercise.reps,
                                date_achieved: new Date().toISOString().split('T')[0],
                                notes: `训练计划完成：第${currentRecord.week_number}周第${currentRecord.day_number}天`
                            }, {
                                onConflict: 'user_id,exercise_name'
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: '训练完成成功',
            data: { record: updatedRecord as any }
        });
    } catch (error: any) {
        console.error('完成训练失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '完成训练失败',
            data: null
        }, { status: 500 });
    }
}


