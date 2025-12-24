import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { GetStudentDto, GetStudentResponseDto } from './entity';

async function getVideoStats(studentId: string) {
    const { data: videos } = await supabase
        .from('training_videos')
        .select('coach_feedback')
        .in('user_id', [studentId]);

    const uploaded = videos?.length || 0;
    const reviewed = videos?.filter(v => (!!v.coach_feedback && Object.keys(v.coach_feedback).length > 0)).length || 0;

    return {
        uploaded,
        reviewed,
    };
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: '未登录用户',
            data: null
        }, { status: 401 });
    }

    const { studentId, subscriptionId } = await req.json() as GetStudentDto;

    // 验证参数
    if (!studentId && !subscriptionId) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: '缺少必要参数：studentId 或 subscriptionId',
            data: null
        }, { status: 400 });
    }

    // 找到教练行
    const { data: coachRow, error: coachErr } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

    if (coachErr || !coachRow?.id) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: '未找到教练身份',
            data: null
        }, { status: 400 });
    }

    let query = supabase
        .from('coach_subscriptions')
        .select('id, student_id, tier, status, start_date, end_date, updated_at, subscribe_data, monthly_price')
        .eq('status', 'active');

    // 根据参数类型构建查询
    if (subscriptionId) {
        query = query.eq('id', subscriptionId);
    } else if (studentId) {
        query = query
            .eq('coach_id', coachRow.id)
            .eq('student_id', studentId);
    }

    // 获取订阅信息
    const { data: sub, error: subsErr } = await query.maybeSingle();

    if (subsErr) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: subsErr.message,
            data: null
        }, { status: 500 });
    }

    if (!sub) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: '未找到该学生或订阅已失效',
            data: null
        }, { status: 404 });
    }

    // 获取用户档案
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', sub.student_id)
        .maybeSingle();

    // 获取视频统计数据
    const videoStats = await getVideoStats(sub.student_id);

    const student = {
        ...sub,
        profile,
        uploaded: videoStats.uploaded,
        reviewed: videoStats.reviewed
    };

    return NextResponse.json<ApiData<GetStudentResponseDto>>({
        success: true,
        message: 'ok',
        data: {
            student
        }
    });
}