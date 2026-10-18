import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { CoachSubscriptionGetDto, QueryCoachSubscription } from './entity';
import { CoachesRow, CoachSubscriptionRow } from '@/types';
import { getSubscriptionLifecycle } from '@/lib/subscriptionLifecycle';
import { deriveSubscriptionCarryoverSummaryFromHistory } from '@/lib/subscriptionCarryover';
import { deriveSubscriptionEntitlementState } from '@/lib/subscriptionEntitlementModel';
import { pickCurrentPlanInstance } from '@/lib/subscriptionBalance';
import { activateQueuedPackageIfReady, getQueuedPackages } from '@/lib/subscriptionPackageQueue';

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
    // 使用统一鉴权函数,支持session和token两种方式 （add）
    const { getAuthUser } = await import('@/lib/auth');
    const authResult = await getAuthUser(req);

    if (!authResult.isAuthenticated || !authResult.userId) {
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
    let subs = (subscriptions ?? []) as any[];

    for (let index = 0; index < subs.length; index++) {
        if (!subs[index]?.payment_data?.pending_package_switch) continue;
        try {
            const result = await activateQueuedPackageIfReady(subs[index].id);
            if (result.subscription) subs[index] = { ...subs[index], ...result.subscription };
            subs[index].queued_packages = await getQueuedPackages(subs[index].id);
        } catch (error) {
            console.error('[coach-subscriptions] package switch deferred', error);
        }
    }

    // 历史数据自愈：处理“已激活但 pending_renew 未兑现”的旧记录（只生效一次，随后清空 pending_renew）。
    const nowForRenewFix = new Date();
    const toApplyPendingRenew = subs
        .filter((s) => s?.status === "active")
        .map((s) => {
            const paymentData =
                s?.payment_data &&
                typeof s.payment_data === "object" &&
                !Array.isArray(s.payment_data)
                    ? (s.payment_data as Record<string, any>)
                    : null;
            const pendingRenew =
                paymentData?.pending_renew &&
                typeof paymentData.pending_renew === "object" &&
                !Array.isArray(paymentData.pending_renew)
                    ? paymentData.pending_renew
                    : null;
            const weeks = Number(pendingRenew?.additional_weeks || 0);
            if (!paymentData || !pendingRenew || weeks <= 0) return null;
            return { sub: s, paymentData, weeks };
        })
        .filter(Boolean) as Array<{ sub: any; paymentData: Record<string, any>; weeks: number }>;

    if (toApplyPendingRenew.length > 0) {
        try {
            const nextSubById = new Map<string, any>();
            for (const item of toApplyPendingRenew) {
                const currentWeeks = Number(item.sub.subscribed_weeks || 0);
                const nextWeeks = currentWeeks + item.weeks;

                const nextPaymentData = {
                    ...item.paymentData,
                    pending_renew: null,
                };

                await supabase
                    .from("coach_subscriptions")
                    .update({
                        subscribed_weeks: nextWeeks,
                        payment_data: nextPaymentData as any,
                        updated_at: nowForRenewFix.toISOString(),
                    })
                    .eq("id", item.sub.id);

                nextSubById.set(item.sub.id, {
                    ...item.sub,
                    subscribed_weeks: nextWeeks,
                    payment_data: nextPaymentData,
                    updated_at: nowForRenewFix.toISOString(),
                });
            }

            if (nextSubById.size > 0) {
                subs = subs.map((s) => nextSubById.get(s.id) || s);
            }
        } catch (e) {
            console.error("[coach-subscriptions] Failed to apply pending_renew fixes:", e);
        }
    }

    // 历史数据自愈：线下续费可能未写入 pending_renew，导致 weeks 未累加。
    // 若存在 offline_payment.expires_at 且尚未应用，则按到期日推导补齐周数（仅执行一次并打标）。
    const DAY_MS = 24 * 60 * 60 * 1000;
    const nowForOfflineRenewFix = new Date();
    const toApplyOfflineRenew = subs
        .filter((s) => s?.status === "active" && String(s?.payment_method || "").toLowerCase() === "offline")
        .map((s) => {
            const paymentData =
                s?.payment_data &&
                typeof s.payment_data === "object" &&
                !Array.isArray(s.payment_data)
                    ? (s.payment_data as Record<string, any>)
                    : null;
            if (!paymentData) return null;
            if (paymentData.offline_renew_applied_at) return null;

            const offlinePayment =
                paymentData?.offline_payment &&
                typeof paymentData.offline_payment === "object" &&
                !Array.isArray(paymentData.offline_payment)
                    ? paymentData.offline_payment
                    : null;
            if (!offlinePayment?.expires_at) return null;

            const expiresAt = new Date(offlinePayment.expires_at);
            if (Number.isNaN(expiresAt.getTime())) return null;
            if (expiresAt.getTime() <= nowForOfflineRenewFix.getTime()) return null;

            return { sub: s, paymentData, expiresAt };
        })
        .filter(Boolean) as Array<{ sub: any; paymentData: Record<string, any>; expiresAt: Date }>;

    if (toApplyOfflineRenew.length > 0) {
        try {
            const nextSubById = new Map<string, any>();
            for (const item of toApplyOfflineRenew) {
                const currentWeeks = Number(item.sub.subscribed_weeks || 0);
                const currentEndDate = item.sub.end_date ? new Date(item.sub.end_date) : null;
                const baseDate =
                    currentEndDate && !Number.isNaN(currentEndDate.getTime()) &&
                        currentEndDate.getTime() > nowForOfflineRenewFix.getTime()
                        ? currentEndDate
                        : nowForOfflineRenewFix;

                const diffMs = item.expiresAt.getTime() - baseDate.getTime();
                const inferredWeeks = diffMs > 0 ? Math.ceil(diffMs / (7 * DAY_MS)) : 0;
                const nextWeeks = currentWeeks + Math.max(0, inferredWeeks);
                const nextPaymentData = {
                    ...item.paymentData,
                    offline_renew_applied_at: nowForOfflineRenewFix.toISOString(),
                };

                await supabase
                    .from("coach_subscriptions")
                    .update({
                        subscribed_weeks: nextWeeks,
                        payment_data: nextPaymentData as any,
                        updated_at: nowForOfflineRenewFix.toISOString(),
                    })
                    .eq("id", item.sub.id);

                nextSubById.set(item.sub.id, {
                    ...item.sub,
                    subscribed_weeks: nextWeeks,
                    payment_data: nextPaymentData,
                    updated_at: nowForOfflineRenewFix.toISOString(),
                });
            }

            if (nextSubById.size > 0) {
                subs = subs.map((s) => nextSubById.get(s.id) || s);
            }
        } catch (e) {
            console.error("[coach-subscriptions] Failed to apply offline renew fixes:", e);
        }
    }

    // 数据归一化：未开始训练的 active 订阅不应携带“已过期”的 end_date。
    // 否则会出现“教练刚确认，学员端仍提示续费”的误判。
    const nowForNormalization = new Date();
    const normalizeEndDateIds = subs
        .filter((s) => {
            if (s?.status !== "active") return false;
            if (s?.start_date) return false;
            if (!s?.end_date) return false;
            const end = new Date(s.end_date);
            if (Number.isNaN(end.getTime())) return false;
            return end.getTime() <= nowForNormalization.getTime();
        })
        .map((s) => s.id)
        .filter(Boolean);

    if (normalizeEndDateIds.length > 0) {
        try {
            await supabase
                .from("coach_subscriptions")
                .update({
                    end_date: null,
                    updated_at: nowForNormalization.toISOString(),
                })
                .in("id", normalizeEndDateIds);

            subs = subs.map((s) =>
                normalizeEndDateIds.includes(s.id)
                    ? { ...s, end_date: null, updated_at: nowForNormalization.toISOString() }
                    : s,
            );
        } catch (e) {
            console.error("[coach-subscriptions] Failed to normalize stale end_date:", e);
        }
    }

    // Attach plan assignment info for ALL active subscriptions (even not started)
    try {
        const activeIds = subs.filter((s) => s?.status === 'active').map((s) => s.id).filter(Boolean);
        if (activeIds.length > 0) {
            const { data: instRows } = await supabase
                .from('coach_plan_instances')
                .select('id, coach_subscription_id, student_id, coach_id, status, created_at')
                .in('coach_subscription_id', activeIds)
                .in('status', ['active', 'paused', 'completed', 'scheduled'])
                .order('created_at', { ascending: false });

            const latestInstanceIdBySub = new Map<string, string>();
            for (const r of (instRows || []) as any[]) {
                const sid = r?.coach_subscription_id;
                if (!sid || !r?.id) continue;
                if (!latestInstanceIdBySub.has(sid)) latestInstanceIdBySub.set(sid, r.id);
            }

            // 自愈：续费/重开后，如果当前 active 订阅未绑定计划，
            // 但同教练同学员存在未完成旧计划（active/paused），则自动迁移绑定到当前订阅，继续原进度。
            const activeSubsWithoutPlan = subs.filter((s) =>
                s?.status === 'active' &&
                !!s?.id &&
                !!s?.student_id &&
                !!s?.coach_id &&
                !latestInstanceIdBySub.has(s.id)
            );

            if (activeSubsWithoutPlan.length > 0) {
                const studentIds = Array.from(
                    new Set(activeSubsWithoutPlan.map((s) => s.student_id).filter(Boolean)),
                );
                const coachIds = Array.from(
                    new Set(activeSubsWithoutPlan.map((s) => s.coach_id).filter(Boolean)),
                );

                const { data: fallbackInstances } = await supabase
                    .from('coach_plan_instances')
                    .select('id, coach_subscription_id, student_id, coach_id, status, created_at')
                    .in('status', ['active', 'paused'])
                    .in('student_id', studentIds)
                    .in('coach_id', coachIds)
                    .order('created_at', { ascending: false });

                const usedInstanceIds = new Set<string>(
                    Array.from(latestInstanceIdBySub.values()),
                );

                for (const sub of activeSubsWithoutPlan as any[]) {
                    const matched = (fallbackInstances || []).find((inst: any) => {
                        if (!inst?.id || usedInstanceIds.has(inst.id)) return false;
                        if (inst?.student_id !== sub.student_id) return false;
                        if (inst?.coach_id !== sub.coach_id) return false;
                        if (inst?.coach_subscription_id === sub.id) return false;
                        if (inst?.coach_subscription_id && activeIds.includes(inst.coach_subscription_id)) {
                            return false;
                        }
                        return true;
                    });

                    if (!matched?.id) continue;

                    try {
                        await supabase
                            .from('coach_plan_instances')
                            .update({
                                coach_subscription_id: sub.id,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', matched.id);

                        latestInstanceIdBySub.set(sub.id, matched.id);
                        usedInstanceIds.add(matched.id);
                    } catch (e) {
                        console.error('[coach-subscriptions] Failed to rebind legacy plan instance:', e);
                    }
                }
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
                    .select('id, coach_subscription_id, training_days, start_execution_day, created_at, status, entitlement_consumption_policy')
                    .in('coach_subscription_id', subscriptionIds)
                    .in('status', ['active', 'paused', 'completed', 'scheduled', 'archived'])
                    .order('created_at', { ascending: false });

                const instancesBySub = new Map<string, any[]>();
                for (const inst of (instances || []) as any[]) {
                    const sid = inst?.coach_subscription_id;
                    if (!sid) continue;
                    instancesBySub.set(sid, [...(instancesBySub.get(sid) || []), inst]);
                }
                const latestInstanceBySub = new Map<string, any>();
                for (const [sid, list] of instancesBySub) {
                    const current = pickCurrentPlanInstance(list);
                    if (current) latestInstanceBySub.set(sid, current);
                }

                const instanceIds = ((instances || []) as any[]).map((i: any) => i.id).filter(Boolean);
                const { data: execs } = instanceIds.length > 0
                    ? await supabase
                        .from('plan_instance_executions')
                        .select('instance_id, day_index, status, started_at, completed_at, created_at')
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

                    const subInstances = (instances || []).filter((item: any) =>
                        item?.coach_subscription_id === s.id
                    );
                    const carryover = deriveSubscriptionCarryoverSummaryFromHistory({
                        subscribedWeeks: weeks,
                        instances: subInstances as any[],
                        executions: (execs || []) as any[],
                        excludeInstanceId: String(inst.id || ''),
                        createdBefore: inst.created_at || null,
                        subscriptionStartDate: s?.start_date || null,
                    });

                    const model = deriveSubscriptionEntitlementState({
                        subscription: s,
                        planInstance: inst,
                        executions: ((execsByInstance.get(inst.id) || []) as any[]).map((e) => ({
                            day_index: e.day_index,
                            status: e.status,
                            completed_at: e.completed_at || null,
                            started_at: e.started_at || null,
                            created_at: e.created_at || null,
                        })) as any[],
                        effectiveSubscribedWeeks: carryover.remainingWeeks,
                    });

                    s.entitlement_status = model.entitlementStatus;
                    s.entitlement_total_credits = model.totalCredits;
                    s.entitlement_used_credits = model.usedCredits;
                    s.entitlement_remaining_credits = model.remainingCredits;
                    s.entitlement_exhausted = model.remainingCredits <= 0 && model.totalCredits > 0;
                    s.plan_progress_status = model.planProgressStatus;
                    s.lifecycle_status = model.lifecycleStatus;
                    s.is_in_grace_period = model.lifecycleStatus === 'expired_grace';
                    s.grace_days_left = model.graceDaysLeft;
                    s.grace_deadline_at = model.graceDeadlineAt;
                    s.should_auto_cancel = model.shouldAutoCancel;
                    s.end_date = model.displayEndDate;
                });
            } catch (e) {
                console.error('[coach-subscriptions] Failed to compute credits-based end_date:', e);
            }
        }
    }

    // 14-day grace policy:
    // - expired within grace: keep relation, lock plan, prompt renewal
    // - expired over grace: auto-cancel relation
    const now = new Date();
    const toAutoCancel = subs.filter((s) => {
        if (s?.status !== 'active') return false;
        if (typeof s?.should_auto_cancel !== 'undefined') {
            return s.should_auto_cancel === true;
        }
        return s?.entitlement_exhausted === true &&
            getSubscriptionLifecycle({ subscription: s, now }).lifecycleStatus === 'expired_cancelled';
    });

    if (toAutoCancel.length > 0) {
        const toAutoCancelIds = toAutoCancel.map((s) => s.id).filter(Boolean);
        const toAutoCancelStudentIds = toAutoCancel
            .map((s) => s.student_id)
            .filter(Boolean);
        const nowIso = now.toISOString();

        try {
            await supabase
                .from('coach_subscriptions')
                .update({
                    status: 'cancelled',
                    updated_at: nowIso,
                })
                .in('id', toAutoCancelIds);

            if (toAutoCancelStudentIds.length > 0) {
                await supabase
                    .from('users')
                    .update({
                        invitation_coach_id: null,
                    })
                    .in('id', toAutoCancelStudentIds);
            }
        } catch (e) {
            console.error('[coach-subscriptions] Failed to auto-cancel over-grace subscriptions:', e);
        }

        subs = subs.map((s) => (
            toAutoCancelIds.includes(s.id)
                ? { ...s, status: 'cancelled', updated_at: nowIso }
                : s
        ));
    }

    // Keep API behavior: onlyActive returns active relations only.
    if (onlyActive) {
        subs = subs.filter((s) => s?.status === 'active');
    }

    // Attach lifecycle fields for UI copy/behavior.
    subs = subs.map((s) => {
        if (typeof s?.lifecycle_status === 'string') {
            return {
                ...s,
                is_in_grace_period: s.lifecycle_status === 'expired_grace',
                grace_days_left: Number(s.grace_days_left || 0),
                grace_deadline_at: s.grace_deadline_at || null,
            };
        }

        const lifecycle = getSubscriptionLifecycle({
            subscription: s,
            now,
        });
        return {
            ...s,
            lifecycle_status: lifecycle.lifecycleStatus,
            is_in_grace_period: lifecycle.isInGracePeriod,
            grace_days_left: lifecycle.graceDaysLeft,
            grace_deadline_at: lifecycle.graceDeadlineAt,
        };
    });

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
