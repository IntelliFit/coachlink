import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { DeleteTrainingPlanDto, DeleteTrainingPlanResponseDto } from './entity';
import type { ApiData } from '@/types/api';

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
    const { training_plan_id } = await req.json() as DeleteTrainingPlanDto;

    if (!training_plan_id) {
        return NextResponse.json({
            success: false,
            message: '缺少训练计划ID',
            data: null
        }, { status: 400 });
    }

    // 确认计划存在且属于当前用户
    const { data: plan, error: planError } = await supabase
        .from('training_plans')
        .select('id, user_id')
        .eq('id', training_plan_id)
        .single();

    if (planError || !plan || plan.user_id !== userId) {
        return NextResponse.json({
            success: false,
            message: '找不到该训练计划或无权限操作',
            data: null
        });
    }

    // 先删依赖项，再删主表（按外键/引用顺序）
    // 1) 找出该计划下的 session 列表，便于删除 training_exercises
    const { data: sessions } = await supabase
        .from('training_sessions')
        .select('id')
        .eq('training_plan_id', training_plan_id);
    const sessionIds = (sessions || []).map(s => s.id);

    // 2) 训练动作（依赖 training_sessions）
    if (sessionIds.length > 0) {
        await supabase
            .from('training_exercises')
            .delete()
            .in('training_session_id', sessionIds);
    }

    // 3) 计划明细
    await supabase
        .from('training_plan_details')
        .delete()
        .eq('training_plan_id', training_plan_id);

    // 4) 训练进度
    await supabase
        .from('training_progress')
        .delete()
        .eq('training_plan_id', training_plan_id);

    // 5) 训练提醒
    await supabase
        .from('training_reminders')
        .delete()
        .eq('training_plan_id', training_plan_id)
        .eq('user_id', userId);

    // 6) 训练日志/记录/视频等可能引用计划ID的表
    await supabase.from('workout_logs').delete().eq('training_plan_id', training_plan_id).eq('user_id', userId);
    await supabase.from('training_records').delete().eq('plan_id', training_plan_id).eq('user_id', userId);
    await supabase.from('training_videos').delete().eq('training_plan_id', training_plan_id).eq('user_id', userId);
    // 可选用户时间线（若存在该表）
    await supabase.from('user_video_timeline').delete().eq('training_plan_id', training_plan_id).eq('user_id', userId);

    // 7) exercises（旧结构里也可能直接挂在 plan 上）
    await supabase
        .from('exercises')
        .delete()
        .eq('training_plan_id', training_plan_id);

    // 8) 删除 sessions 本身
    if (sessionIds.length > 0) {
        await supabase
            .from('training_sessions')
            .delete()
            .in('id', sessionIds);
    }

    // 9) 删除计划
    const { error: delError } = await supabase
        .from('training_plans')
        .delete()
        .eq('id', training_plan_id)
        .eq('user_id', userId);

    if (delError) {
        return NextResponse.json({
            success: false,
            message: delError.message,
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<DeleteTrainingPlanResponseDto>>({
        success: true,
        message: '删除训练计划成功',
        data: '删除训练计划成功'
    });
}


