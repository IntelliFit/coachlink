import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { GetWeekRecordsDto, GetWeekRecordsResponseDto, WeekDayRecord } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;

    const {
        training_plan_id,
        week_number
    } = await req.json() as GetWeekRecordsDto;

    if (!training_plan_id || !week_number) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '缺少必要参数',
            data: null
        }, { status: 400 });
    }

    try {
        // 获取该周的所有训练日 - 使用正确的表名 training_plan_details
        const { data: weekDays, error: weekDaysError } = await supabase
            .from('training_plan_details')
            .select('day_of_week, order_index')
            .eq('training_plan_id', training_plan_id)
            .eq('week_number', week_number)
            .order('order_index', { ascending: true });

        if (weekDaysError) {
            console.error('获取训练日失败:', weekDaysError);
            throw weekDaysError;
        }

        // 获取该用户在该计划该周的所有训练记录
        const { data: records, error: recordsError } = await supabase
            .from('training_records')
            .select('week_number, day_number, status, completed_sets, total_sets, training_date')
            .eq('user_id', userId)
            .eq('plan_id', training_plan_id)
            .eq('week_number', week_number)
            .in('status', ['in_progress', 'completed', 'abandoned']);

        if (recordsError) {
            console.error('获取训练记录失败:', recordsError);
            throw recordsError;
        }

        // 构建结果：将记录按 day_of_week 组织
        const weekDayRecords: WeekDayRecord[] = [];

        if (weekDays && weekDays.length > 0) {
            weekDays.forEach((day, index) => {
                // 使用迭代索引作为 day_number（1-indexed）
                // day_number 表示这是第几个训练日（第1天、第2天、第3天...）
                const dayNumber = index + 1;
                
                // 找到对应的训练记录（通过 day_number 匹配）
                const record = records?.find(r => r.day_number === dayNumber);

                weekDayRecords.push({
                    day_of_week: day.day_of_week,
                    status: record ? (record.status as 'in_progress' | 'completed' | 'abandoned') : null,
                    completed_sets: record?.completed_sets || 0,
                    total_sets: record?.total_sets || 0,
                    training_date: record?.training_date || ''
                });
            });
        }

        return NextResponse.json<ApiData<GetWeekRecordsResponseDto>>({
            success: true,
            message: '获取训练记录成功',
            data: {
                records: weekDayRecords
            }
        });
    } catch (error: any) {
        console.error('获取周训练记录失败:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '获取训练记录失败',
            data: null
        }, { status: 500 });
    }
}

