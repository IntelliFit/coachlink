import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import { fenToYuan } from '@/lib/moneyUtils';
import type { ApiData } from '@/types/api';
import type { GetStudentDto, GetStudentResponseDto } from './entity';
import { getCurrent1RMRecords } from '../../student/get-current-1rm/route';

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
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const {
        studentId,
        subscriptionId,
        need1RM = false
    } = await req.json() as GetStudentDto;

    if (!studentId && !subscriptionId) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: '缺少必要参数：studentId 或 subscriptionId',
            data: null
        }, { status: 400 });
    }

    const { data: coachRow, error: coachErr } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', authResult.userId)
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
        .select('id, coach_id, student_id, tier, status, start_date, end_date, updated_at, subscribe_data, monthly_price, subscribed_weeks, prior_training_weeks, order_id, last_payment_order_id, payment_method')
        .eq('status', 'active');

    if (subscriptionId) {
        query = query.eq('id', subscriptionId).eq('coach_id', coachRow.id);
    } else if (studentId) {
        query = query
            .eq('coach_id', coachRow.id)
            .eq('student_id', studentId);
    }

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

    const [{ data: profile }, { data: userRow }] = await Promise.all([
        supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', sub.student_id)
            .maybeSingle(),
        supabase
            .from('users')
            .select('id, phone, email, wechat_openid')
            .eq('id', sub.student_id)
            .maybeSingle(),
    ]);

    const isDeactivatedUser = !userRow?.phone && !userRow?.email && !userRow?.wechat_openid;
    const hasVisibleProfileIdentity = Boolean(profile?.nickname || profile?.full_name);
    if (isDeactivatedUser || !hasVisibleProfileIdentity) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: '未找到该学生或账号已注销',
            data: null
        }, { status: 404 });
    }

    const videoStats = await getVideoStats(sub.student_id);

    const student = {
        ...sub,
        monthly_price: fenToYuan(sub.monthly_price ?? 0),
        profile,
        uploaded: videoStats.uploaded,
        reviewed: videoStats.reviewed
    } as GetStudentResponseDto['student'];

    if (need1RM) {
        const records = await getCurrent1RMRecords(authResult.userId, {
            targetUserId: student.student_id,
            preferPR: true,
        });
        const rmMap: Record<string, number> = {};
        for (const record of records) {
            if (record.actionId) {
                rmMap[record.actionId] = Math.max(rmMap[record.actionId] || 0, record.current1RM);
            }
            if (record.actionName) {
                rmMap[record.actionName] = Math.max(rmMap[record.actionName] || 0, record.current1RM);
            }
            if (record.canonicalActionId) {
                rmMap[record.canonicalActionId] = Math.max(rmMap[record.canonicalActionId] || 0, record.current1RM);
            }
        }
        student.aggregated1RM = rmMap;
    }

    return NextResponse.json<ApiData<GetStudentResponseDto>>({
        success: true,
        message: 'ok',
        data: {
            student
        }
    });
}
