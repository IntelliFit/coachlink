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
    } = await req.json() as CoachSubscriptionGetDto;

    if (studentId) {
        const { data: subscriptions, error: subscriptionsError } = await supabase
            .from('coach_subscriptions')
            .select('*')
            .eq('student_id', studentId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (subscriptionsError || !subscriptions) {
            return NextResponse.json({
                success: false,
                message: subscriptionsError.message,
                data: null,
            });
        }

        return NextResponse.json({
            success: true,
            message: '获取训练计划成功',
            data: {
                subscriptions: embeddingCaochesIntoSubscriptions(subscriptions),
                studentId
            },
        });
    }

    if (coachId) {
        const { data: subscriptions, error: subscriptionsError } = await supabase
            .from('coach_subscriptions')
            .select('*')
            .eq('coach_id', coachId)
            .order('created_at', { ascending: false });
        
        if (subscriptionsError || !subscriptions) {
            return NextResponse.json({
                success: false,
                message: subscriptionsError.message,
            });
        }

        return NextResponse.json({
            success: true,
            message: '获取训练计划成功',
            data: {
                subscriptions: embeddingCaochesIntoSubscriptions(subscriptions),
                coachId
            },
        });
    }
    
    return NextResponse.json({
        success: false,
        message: '获取失败，参数不正确',
    });
}