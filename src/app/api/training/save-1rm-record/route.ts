import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { Save1RMRecordDto, Save1RMRecordResponseDto } from './entity';

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
    const body = await req.json() as Save1RMRecordDto;

    // 验证输入
    if (!body.exercise_name || !body.max_weight || body.max_weight <= 0) {
        return NextResponse.json({
            success: false,
            message: '请输入有效的动作名称和重量',
            data: null
        }, { status: 400 });
    }

    try {
        // 检查是否已存在该动作的记录
        const { data: existingRecord } = await supabase
            .from('personal_records')
            .select('*')
            .eq('user_id', userId)
            .eq('exercise_name', body.exercise_name)
            .order('max_weight', { ascending: false })
            .limit(1)
            .maybeSingle();

        let recordId: string;
        let isNewRecord: boolean;

        // 判断是否为新记录：没有历史记录或打破了历史记录
        if (!existingRecord) {
            // 第一次记录，算作新记录
            isNewRecord = true;
            
            const { data: newRecord, error } = await supabase
                .from('personal_records')
                .insert({
                    user_id: userId,
                    exercise_name: body.exercise_name,
                    max_weight: body.max_weight,
                    max_reps: body.max_reps || 1,
                    date_achieved: new Date().toISOString().split('T')[0],
                    notes: body.notes || '训练中记录的第一个1RM'
                })
                .select()
                .single();

            if (error) {
                console.error('插入1RM记录失败:', error);
                return NextResponse.json({
                    success: false,
                    message: '保存1RM记录失败',
                    data: null
                }, { status: 500 });
            }

            recordId = newRecord.id;
        } else if (body.max_weight > (existingRecord.max_weight || 0)) {
            // 打破了历史记录
            isNewRecord = true;
            
            const { data: newRecord, error } = await supabase
                .from('personal_records')
                .insert({
                    user_id: userId,
                    exercise_name: body.exercise_name,
                    max_weight: body.max_weight,
                    max_reps: body.max_reps || 1,
                    date_achieved: new Date().toISOString().split('T')[0],
                    notes: body.notes || '训练中打破1RM记录'
                })
                .select()
                .single();

            if (error) {
                console.error('插入1RM记录失败:', error);
                return NextResponse.json({
                    success: false,
                    message: '保存1RM记录失败',
                    data: null
                }, { status: 500 });
            }

            recordId = newRecord.id;
        } else {
            // 没有打破记录，但仍然记录下来
            isNewRecord = false;
            
            const { data: newRecord, error } = await supabase
                .from('personal_records')
                .insert({
                    user_id: userId,
                    exercise_name: body.exercise_name,
                    max_weight: body.max_weight,
                    max_reps: body.max_reps || 1,
                    date_achieved: new Date().toISOString().split('T')[0],
                    notes: body.notes || '训练中记录的1RM（未打破记录）'
                })
                .select()
                .single();

            if (error) {
                console.error('插入1RM记录失败:', error);
                return NextResponse.json({
                    success: false,
                    message: '保存1RM记录失败',
                    data: null
                }, { status: 500 });
            }

            recordId = newRecord.id;
        }

        return NextResponse.json<ApiData<Save1RMRecordResponseDto>>({
            success: true,
            message: isNewRecord
                ? '🎉 恭喜！创建或打破个人记录！' 
                : '✅ 1RM记录已保存',
            data: {
                record_id: recordId,
                is_new_record: isNewRecord
            }
        });
    } catch (error) {
        console.error('保存1RM记录失败:', error);
        return NextResponse.json({
            success: false,
            message: '保存1RM记录失败',
            data: null
        }, { status: 500 });
    }
}

