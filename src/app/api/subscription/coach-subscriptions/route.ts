import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { CoachSubscriptionGetDto, QueryCoachSubscription } from './entity';
import { CoachesRow, CoachSubscriptionRow } from '@/types';
import { computeCreditsScope, computeUsedCredits, estimateRemainingDays } from '@/lib/subscriptionCredits';

async function embeddingCaochesIntoSubscriptions(subscriptions: CoachSubscriptionRow[]) {
    const coachIds = Array.from(
        new Set((subscriptions || []).map((s) => s.coach_id).filter(Boolean)),
    ) as string[];

    const coachMap = new Map<string, CoachesRow | null>();
    if (coachIds.length > 0) {
        const { data: coaches } = await supabase
            .from('coaches')
            .select('*')
            .in('id', coachIds);
        for (const c of coaches || []) {
            coachMap.set((c as any).id, c as any);
        }
    }

    // Fill missing as null
    for (const id of coachIds) {
        if (!coachMap.has(id)) coachMap.set(id, null);
    }

    return (subscriptions || []).map((subscription) => ({
        ...subscription,
        coach: coachMap.get(subscription.coach_id) as CoachesRow | null,
    })) as QueryCoachSubscription[];
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
        onlyActive = true,
        computePauseAwareEndDate = true,
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

    // B1: end_date is an estimated completion date driven by credits (training-day consumption).
    // Also, expose plan assignment info so UI can distinguish:
    // - 制定中: active subscription but no plan assigned yet
    // - 未开始: plan assigned but student hasn't started training yet (start_date is null)
    const subs = (subscriptions ?? []) as any[];

    // Attach plan assignment info for ALL active subscriptions (even not started)
    try {
        const activeIds = subs.filter((s) => s?.status === 'active').map((s) => s.id).filter(Boolean);
        if (activeIds.length > 0) {
            const { data: instRows } = await supabase
                .from('coach_plan_instances')
                .select('id, coach_subscription_id, created_at')
                .in('coach_subscription_id', activeIds)
                .order('created_at', { ascending: false });

            const latestInstanceIdBySub = new Map<string, string>();
            for (const r of (instRows || []) as any[]) {
                const sid = r?.coach_subscription_id;
                if (!sid || !r?.id) continue;
                if (!latestInstanceIdBySub.has(sid)) latestInstanceIdBySub.set(sid, r.id);
            }

            subs.forEach((s) => {
                if (s?.status !== 'active') return;
                const latestId = latestInstanceIdBySub.get(s.id) || null;
                s.latest_plan_instance_id = latestId;
                s.has_plan_instance = !!latestId;
            });
        }
    } catch (e) {
        console.error('[coach-subscriptions] Failed to attach plan assignment info:', e);
    }

    if (computePauseAwareEndDate) {
        const activeSubs = subs.filter((s) =>
            s?.status === 'active' && s?.start_date && (s?.subscribed_weeks || 0) > 0
        );

        if (activeSubs.length > 0) {
            try {
                const subscriptionIds = activeSubs.map((s) => s.id);

                // Latest plan instance per subscription (for training_days cadence & start_execution_day)
                const { data: instances } = await supabase
                    .from('coach_plan_instances')
                    .select('id, coach_subscription_id, training_days, start_execution_day, created_at')
                    .in('coach_subscription_id', subscriptionIds)
                    .order('created_at', { ascending: false });

                const latestInstanceBySub = new Map<string, any>();
                for (const inst of (instances || []) as any[]) {
                    const sid = inst?.coach_subscription_id;
                    if (!sid) continue;
                    if (!latestInstanceBySub.has(sid)) latestInstanceBySub.set(sid, inst);
                }

                const instanceIds = Array.from(latestInstanceBySub.values()).map((i: any) => i.id).filter(Boolean);
                const { data: execs } = instanceIds.length > 0
                    ? await supabase
                        .from('plan_instance_executions')
                        .select('instance_id, day_index, status')
                        .in('instance_id', instanceIds)
                        .eq('status', 'completed')
                    : { data: [] as any[] };

                const execsByInstance = new Map<string, any[]>();
                (execs || []).forEach((e: any) => {
                    const arr = execsByInstance.get(e.instance_id) || [];
                    arr.push(e);
                    execsByInstance.set(e.instance_id, arr);
                });

                // compute effective end_date per subscription (estimated completion date)
                subs.forEach((s) => {
                    if (!(s?.status === 'active' && s?.start_date && (s?.subscribed_weeks || 0) > 0)) return;
                    const inst = latestInstanceBySub.get(s.id);
                    if (!inst?.training_days) return;

                    const weeks = Number(s.subscribed_weeks || 0);
                    if (!weeks || weeks <= 0) return;

                    const scope = computeCreditsScope({
                        trainingDays: (inst.training_days as any[]) || [],
                        startExecutionDay: Number(inst.start_execution_day || 1),
                        subscribedWeeks: weeks,
                    });

                    const totalCredits = scope.totalCredits;
                    if (totalCredits <= 0) return;

                    const usedCredits = computeUsedCredits({
                        eligibleTrainingDayIndexSet: scope.eligibleTrainingDayIndexSet,
                        executions: ((execsByInstance.get(inst.id) || []) as any[]).map((e) => ({
                            day_index: e.day_index,
                            status: e.status,
                        })),
                    });

                    const remainingCredits = Math.max(0, totalCredits - usedCredits);
                    if (remainingCredits === 0) {
                        // Credits consumed: mark as ended by setting end_date to now; keep status unchanged (DB constraint).
                        s.end_date = new Date().toISOString();
                        return;
                    }

                    const remainingDaysEstimate = estimateRemainingDays({
                        subscribedWeeks: weeks,
                        totalCredits,
                        remainingCredits,
                        fallbackCreditsPerWeek: 3,
                    });
                    const end = new Date();
                    end.setDate(end.getDate() + remainingDaysEstimate);
                    s.end_date = end.toISOString();
                });
            } catch (e) {
                console.error('[coach-subscriptions] Failed to compute credits-based end_date:', e);
            }
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
