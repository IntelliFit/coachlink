import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from "../../auth/[...nextauth]/auth";
import { ListSubscriptionGetDto, QueryCoachSubscription } from './entity';
import { CoachesRow, CoachSubscriptionRow, UserProfilesRow } from '@/types';

async function embeddingCaochesIntoSubscriptions(subscriptions: CoachSubscriptionRow[]) {
    const coaches = new Map<string, CoachesRow | null>();
    const students = new Map<string, UserProfilesRow | null>();
    const coachesProfiles = new Map<string, UserProfilesRow | null>();
    const querySubscriptions: QueryCoachSubscription[] = [];
    
    // 预先获取所有需要的教练信息
    const uniqueCoachIds = [...new Set(subscriptions.map(s => s.coach_id))];
    if (uniqueCoachIds.length > 0) {
        const { data: coachesData } = await supabase
            .from('coaches')
            .select('*')
            .in('id', uniqueCoachIds);
        
        coachesData?.forEach(coach => coaches.set(coach.id, coach));
    }
    
    // 预先获取所有需要的学生信息
    const uniqueStudentIds = [...new Set(subscriptions.map(s => s.student_id))];
    if (uniqueStudentIds.length > 0) {
        const { data: studentsData } = await supabase
            .from('user_profiles')
            .select('*')
            .in('user_id', uniqueStudentIds);
        
        studentsData?.forEach(student => students.set(student.user_id, student));
    }
    
    // 预先获取所有需要的教练用户信息
    if (uniqueCoachIds.length > 0) {
        const { data: coachesProfilesData } = await supabase
            .from('user_profiles')
            .select('*')
            .in('user_id', uniqueCoachIds);
        
        coachesProfilesData?.forEach(profile => coachesProfiles.set(profile.user_id, profile));
    }

    for (const subscription of subscriptions) {
        querySubscriptions.push({
            ...subscription,
            coach: coaches.get(subscription.coach_id) || null,
            studentProfile: students.get(subscription.student_id) || null,
            coachProfile: coachesProfiles.get(subscription.coach_id) || null
        });
    }

    return querySubscriptions;
}

export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session || !session.user?.id) {
        return NextResponse.json({
            success: false,
            message: 'Unauthorized',
            data: null,
        });
    }

    const {
        studentId = '',
        coachId = '',
        onlyActive = true,
        page = 1,
        limit = 10,
        status
    } = await req.json() as ListSubscriptionGetDto;

    // 构建基础查询
    let query = supabase
        .from('coach_subscriptions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    // 动态添加 where 条件
    if (studentId) {
        query = query.eq('student_id', studentId);
    }

    if (coachId) {
        query = query.eq('coach_id', coachId);
    }

    if (onlyActive && !status) {
        query = query.eq('status', 'active');
    }
    
    if (status) {
        query = query.eq('status', status);
    }

    // 添加分页
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // 执行查询
    const { data: subscriptions, error, count } = await query;

    if (error) {
        return NextResponse.json({
            success: false,
            message: error.message,
            data: null,
        });
    }

    return NextResponse.json({
        success: true,
        message: '获取订阅教练成功',
        data: {
            subscriptions: await embeddingCaochesIntoSubscriptions(subscriptions ?? []),
            studentId: studentId || undefined,
            coachId: coachId || undefined,
            total: count,
            page,
            limit
        },
    });
}