import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import { fenToYuan } from '@/lib/moneyUtils';
import type { ApiData } from '@/types/api';
import type { GetStudentDto, GetStudentResponseDto } from './entity';
import { getCurrent1RMRecords } from '../../student/get-current-1rm/route';

const SUBSCRIPTION_COLUMNS = 'id, coach_id, student_id, tier, status, start_date, end_date, updated_at, subscribe_data, monthly_price, subscribed_weeks, prior_training_weeks, order_id, last_payment_order_id, payment_method';

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

    // 订阅查询用 coaches!inner(user_id) 直接按当前登录用户过滤，
    // 与教练身份查询同时发起；越权边界在这一段内完成，不再依赖 coachRow.id 串行。
    let query = supabase
        .from('coach_subscriptions')
        .select(`${SUBSCRIPTION_COLUMNS}, coaches!inner(user_id)`)
        .eq('coaches.user_id', authResult.userId)
        .eq('status', 'active');

    if (subscriptionId) {
        query = query.eq('id', subscriptionId);
    } else if (studentId) {
        query = query.eq('student_id', studentId);
    }

    const [{ data: coachRow, error: coachErr }, { data: subRow, error: subsErr }] = await Promise.all([
        supabase
            .from('coaches')
            .select('id')
            .eq('user_id', authResult.userId)
            .maybeSingle(),
        query.maybeSingle(),
    ]);

    if (coachErr || !coachRow?.id) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: '未找到教练身份',
            data: null
        }, { status: 400 });
    }

    if (subsErr) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: subsErr.message,
            data: null
        }, { status: 500 });
    }

    // 二次确认订阅归属当前教练，防止联表过滤失效时越权
    if (!subRow || subRow.coach_id !== coachRow.id) {
        return NextResponse.json<ApiData<GetStudentResponseDto>>({
            success: false,
            message: '未找到该学生或订阅已失效',
            data: null
        }, { status: 404 });
    }

    const { coaches: _coachJoin, ...sub } = subRow as typeof subRow & { coaches?: unknown };

    // 此处已确认当前教练持有该学员的有效订阅，1RM 查询跳过内部的重复权限复查，
    // 并与学员资料、视频统计同时发起。
    const [{ data: profile }, { data: userRow }, videoStats, oneRMRecords] = await Promise.all([
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
        getVideoStats(sub.student_id),
        need1RM
            ? getCurrent1RMRecords(authResult.userId, {
                targetUserId: sub.student_id,
                preferPR: true,
            }, { authorizationVerified: true })
            : Promise.resolve(null),
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

    const student = {
        ...sub,
        monthly_price: fenToYuan(sub.monthly_price ?? 0),
        profile,
        uploaded: videoStats.uploaded,
        reviewed: videoStats.reviewed
    } as GetStudentResponseDto['student'];

    if (oneRMRecords) {
        const rmMap: Record<string, number> = {};
        for (const record of oneRMRecords) {
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
