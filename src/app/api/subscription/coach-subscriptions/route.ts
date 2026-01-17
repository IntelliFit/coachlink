import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
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

function dateOnly(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function isoDateKey(date: Date) {
    const d = dateOnly(date);
    return d.toISOString().slice(0, 10);
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
        onlyActive = true
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
        query = query.eq('student_id', studentId);
    }

    if (coachId) {
        query = query.eq('coach_id', coachId);
    }

    if (onlyActive) {
        query = query.eq('status', 'active');
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

    // Pause-aware end_date: remaining days only decrease on "active training days"
    // (days with at least one plan_instance_execution). On gap days, end_date is auto-extended.
    const subs = (subscriptions ?? []) as any[];
    const activeSubs = subs.filter((s) => s?.status === 'active' && s?.start_date && (s?.subscribed_weeks || 0) > 0);

    if (activeSubs.length > 0) {
        try {
            const subscriptionIds = activeSubs.map((s) => s.id);

            // 1) map subscription -> instanceIds
            const { data: instances } = await supabase
                .from('coach_plan_instances')
                .select('id, coach_subscription_id')
                .in('coach_subscription_id', subscriptionIds);

            const subToInstanceIds = new Map<string, string[]>();
            (instances || []).forEach((row: any) => {
                if (!row?.coach_subscription_id || !row?.id) return;
                const prev = subToInstanceIds.get(row.coach_subscription_id) || [];
                prev.push(row.id);
                subToInstanceIds.set(row.coach_subscription_id, prev);
            });

            // 2) fetch executions for those instances (exclude abandoned)
            const allInstanceIds = Array.from(new Set((instances || []).map((r: any) => r.id).filter(Boolean)));
            const instanceToSub = new Map<string, string>();
            (instances || []).forEach((r: any) => {
                if (r?.id && r?.coach_subscription_id) instanceToSub.set(r.id, r.coach_subscription_id);
            });

            const subToActiveDayKeys = new Map<string, Set<string>>();
            if (allInstanceIds.length > 0) {
                const { data: execs } = await supabase
                    .from('plan_instance_executions')
                    .select('instance_id, started_at, status')
                    .in('instance_id', allInstanceIds)
                    .neq('status', 'abandoned');

                (execs || []).forEach((e: any) => {
                    const subId = instanceToSub.get(e.instance_id);
                    if (!subId) return;
                    const startedAt = e.started_at ? new Date(e.started_at) : null;
                    if (!startedAt) return;
                    const key = isoDateKey(startedAt);
                    const set = subToActiveDayKeys.get(subId) || new Set<string>();
                    set.add(key);
                    subToActiveDayKeys.set(subId, set);
                });
            }

            // 3) compute effective end_date per subscription
            const now0 = dateOnly(new Date());
            subs.forEach((s) => {
                if (!(s?.status === 'active' && s?.start_date && (s?.subscribed_weeks || 0) > 0)) return;
                const start0 = dateOnly(new Date(s.start_date));
                const totalDays = Number(s.subscribed_weeks) * 7;

                // days since start, inclusive
                const diffDays = Math.floor((now0.getTime() - start0.getTime()) / (1000 * 60 * 60 * 24));
                const daysSinceStart = Math.max(1, diffDays + 1);

                const activeDays = (subToActiveDayKeys.get(s.id) || new Set<string>()).size;
                const pausedDays = Math.max(0, daysSinceStart - activeDays);

                const effectiveEnd = addDays(start0, totalDays + pausedDays);
                s.end_date = effectiveEnd.toISOString();
            });
        } catch (e) {
            console.error('[coach-subscriptions] Failed to compute pause-aware end_date:', e);
        }
    }

    return NextResponse.json({
        success: true,
        message: '获取订阅教练成功',
        data: {
            subscriptions: await embeddingCaochesIntoSubscriptions(subs as any),
            studentId: studentId || undefined,
            coachId: coachId || undefined,
        },
    });
}
