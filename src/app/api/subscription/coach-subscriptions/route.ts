import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from "../../auth/[...nextauth]/auth";
import { CoachSubscriptionGetDto, QueryCoachSubscription } from './entity';
import { CoachesRow, CoachSubscriptionRow } from '@/types';

async function embeddingCaochesIntoSubscriptions(subscriptions: CoachSubscriptionRow[]) {
    const coaches = new Map<string, CoachesRow | null>();
    const querySubscriptions: QueryCoachSubscription[] = [];
    for (const subscription of subscriptions) {
        if (!coaches.has(subscription.coach_id)) {
            const { data: coach, error } = await supabase
                .from('coaches')
                .select('*')
                .eq('id', subscription.coach_id)
                .single();
            
            coaches.set(subscription.coach_id, coach);
        }

        querySubscriptions.push({
            ...subscription,
            coach: coaches.get(subscription.coach_id) as CoachesRow | null
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
        coachId = ''
    } = await req.json() as CoachSubscriptionGetDto;

    // 参数检查
    if (!studentId && !coachId) {
        return NextResponse.json({
            success: false,
            message: '获取失败，需要 studentId 或 coachId',
        });
    }

    // 构建基础查询
    let query = supabase
        .from('coach_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

    // 动态添加 where 条件
    if (studentId) {
        query = query.eq('student_id', studentId).eq('status', 'active');
    }

    if (coachId) {
        query = query.eq('coach_id', coachId);
    }

    // 执行查询
    const { data: subscriptions, error } = await query;

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
        },
    });
}
