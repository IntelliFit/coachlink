import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

/**
 * 获取训练日的日期信息
 * 用于判断该训练日是历史记录、当前训练还是未来计划
 */
export async function POST(req: Request) {
    try {
        // 验证用户登录状态
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: '未登录' },
                { status: 401 }
            );
        }

        const { training_plan_id, week_number, day_number } = await req.json();

        if (!training_plan_id || !week_number || !day_number) {
            return NextResponse.json(
                { success: false, error: '缺少必要参数' },
                { status: 400 }
            );
        }

        // 1. 查询是否存在该训练日的训练记录
        const { data: trainingRecord, error: recordError } = await supabase
            .from('training_records')
            .select('id, status, created_at, updated_at, completed_at, training_date')
            .eq('plan_id', training_plan_id)
            .eq('week_number', week_number)
            .eq('day_number', day_number)
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (recordError) {
            console.error('查询训练记录失败:', recordError);
        }
        
        // 2. 计算当前周次（为了匹配 OldTodayTraining 的逻辑）
        // 我们需要知道现在是第几周，才能判断 week_number 是过去、现在还是未来
        const currentWeek = await calculateCurrentWeekNumber(session.user.id, training_plan_id);

        // 3. 获取今天的 dayOfWeek (Sun, Mon, etc.)
        // 注意：这里使用北京时间来判断，避免 UTC 时区问题
        const today = new Date();
        // 调整为北京时间 (UTC+8)
        const beijingTime = new Date(today.getTime() + (8 * 60 * 60 * 1000)); 
        // 注意：getUTCDay() 返回的是 0(Sun)-6(Sat)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayDayOfWeek = days[beijingTime.getUTCDay()];
        
        // 获取今天的日期字符串 YYYY-MM-DD (北京时间)
        const todayStr = beijingTime.toISOString().split('T')[0];

        // 4. 查询目标训练日对应的 day_of_week
        const { data: planDetail, error: detailError } = await supabase
            .from('training_plan_details')
            .select('day_of_week')
            .eq('training_plan_id', training_plan_id)
            .eq('week_number', week_number)
            // 注意：这里假设 day_number 和 order_index 或者某种顺序有关
            // 但通常 details 表里没有 day_number 字段，而是通过 week_number 和 order_index 排序
            // 假设 day_number 1 对应排序后的第一条记录
            .order('order_index', { ascending: true });
            
        let targetDayOfWeek = '';
        if (planDetail && planDetail.length >= day_number) {
            targetDayOfWeek = planDetail[day_number - 1].day_of_week;
        }

        // 5. 核心逻辑判定：是否只读
        let trainingDayStatus: 'past' | 'today' | 'future' = 'today';
        let shouldBeReadOnly = false;

        console.log('[get-training-day-date] 判断参数:', {
            week_number,
            currentWeek,
            targetDayOfWeek,
            todayDayOfWeek,
            hasRecord: !!trainingRecord
        });

        if (trainingRecord) {
            // 如果有训练记录
            if (trainingRecord.status === 'completed') {
                // 已完成 -> 过去/只读
                trainingDayStatus = 'past';
                shouldBeReadOnly = true;
            } else {
                // 未完成
                // 检查记录日期是否是今天 (北京时间)
                const recordDateStr = trainingRecord.training_date?.split('T')[0];
                
                if (recordDateStr === todayStr) {
                    trainingDayStatus = 'today';
                    shouldBeReadOnly = false;
                } else if (recordDateStr < todayStr) {
                    trainingDayStatus = 'past';
                    shouldBeReadOnly = true; // 过期未完成 -> 只读
                } else {
                    trainingDayStatus = 'future';
                    shouldBeReadOnly = true; // 未来的 -> 只读
                }
            }
        } else {
            // 无训练记录
            // 使用 OldTodayTraining 的逻辑：
            // 只有 (week == currentWeek) && (targetDayOfWeek == todayDayOfWeek) 才是今天，其他都是只读
            
            if (week_number < currentWeek) {
                trainingDayStatus = 'past';
                shouldBeReadOnly = true; // 过去周 -> 只读 (全空预览)
                console.log('[get-training-day-date] 判定结果: 过去的周，只读');
            } else if (week_number > currentWeek) {
                trainingDayStatus = 'future';
                shouldBeReadOnly = true; // 未来周 -> 只读
                console.log('[get-training-day-date] 判定结果: 未来的周，只读');
            } else {
                // 当前周
                if (targetDayOfWeek === todayDayOfWeek) {
                    trainingDayStatus = 'today';
                    shouldBeReadOnly = false; // 只有今天可写
                    console.log('[get-training-day-date] 判定结果: 今天，可编辑');
                } else {
                    // 当前周的其他天 -> 只读 (无法判断是过去还是未来，暂定为 past/future 均可，这里为了安全设为 past)
                    // 实际上需要比较 dayOfWeek 的顺序，但 OldTodayTraining 并没有比较顺序，只是 != today 就只读
                    // 我们可以简单判断：如果今天还没到这个 dayOfWeek，就是 future；过了就是 past
                    const dayOrder = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
                    // @ts-ignore
                    const todayOrder = dayOrder[todayDayOfWeek] || 0;
                    // @ts-ignore
                    const targetOrder = dayOrder[targetDayOfWeek] || 0;
                    
                    if (targetOrder < todayOrder) {
                        trainingDayStatus = 'past';
                    } else {
                        trainingDayStatus = 'future';
                    }
                    shouldBeReadOnly = true;
                    console.log('[get-training-day-date] 判定结果: 当前周的其他天，只读');
                }
            }
        }

        console.log('[get-training-day-date] 最终返回:', { 
            week_number, 
            day_number, 
            trainingDayStatus, 
            shouldBeReadOnly 
        });

        // 构造返回的 planned_date (仅供参考)
        const plannedDate = trainingRecord 
            ? new Date(trainingRecord.training_date)
            : new Date(); // 如果没记录，返回当前时间作为占位，因为我们不再依赖日期推算逻辑

        return NextResponse.json({
            success: true,
            data: {
                training_plan_id,
                week_number,
                day_number,
                planned_date: plannedDate.toISOString(),
                training_day_status: trainingDayStatus,
                should_be_read_only: shouldBeReadOnly,
                has_training_record: !!trainingRecord,
                training_record_id: trainingRecord?.id || null,
                training_record_status: trainingRecord?.status || null,
                training_record_updated_at: trainingRecord?.updated_at || null,
                training_record_completed_at: trainingRecord?.completed_at || null,
            }
        });

    } catch (error: any) {
        console.error('获取训练日日期信息失败:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error.message || '服务器内部错误' 
            },
            { status: 500 }
        );
    }
}

// 复用 get-hub-data 中的计算周次逻辑
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
