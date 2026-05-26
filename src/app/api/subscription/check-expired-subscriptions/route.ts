import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CheckExpiredSubscriptionsDto,
    CheckExpiredSubscriptionsResponseDto,
} from "./entity";
import { deriveSubscriptionCarryoverSummaryFromHistory } from "@/lib/subscriptionCarryover";
import { deriveSubscriptionEntitlementState } from "@/lib/subscriptionEntitlementModel";

export async function POST(req: Request) {
    const startTime = performance.now();
    const timings: Record<string, number> = {};

    // 1. 认证检查
    const authStart = performance.now();
    const session = await getServerSession();
    const userId = session?.user?.id || null;
    timings['1_auth'] = performance.now() - authStart;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 检查过期订阅逻辑 - 这个端点可以由定时任务调用，检查所有订阅的到期情况
    // B1: 按"训练日次数 credits"判断订阅是否到期（次数用完才过期）。
    // end_date 仅用于 UI 显示的"预计完成日"，不是硬日历到期。
    const nowIso = new Date().toISOString();

    // 2. 查询活跃订阅候选
    const candidatesStart = performance.now();
    // Fetch active candidates (started only); cancelled/expired ignored.
    // NOTE: start_date is set at first execution start.
    const { data: candidates, error } = await supabase
        .from("coach_subscriptions")
        .select("id, student_id, coach_id, status, start_date, end_date, subscribed_weeks")
        .eq("status", "active")
        .not("start_date", "is", null)
        .gt("subscribed_weeks", 0);
    timings['2_query_candidates'] = performance.now() - candidatesStart;

    if (error) {
        console.error("检查过期订阅失败:", error);
        timings['total'] = performance.now() - startTime;
        console.log('[check-expired-subscriptions] Performance timings:', JSON.stringify(timings, null, 2));
        return NextResponse.json<ApiData<CheckExpiredSubscriptionsResponseDto>>({
            success: false,
            message: "检查过期订阅失败",
            data: null,
        }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
        timings['total'] = performance.now() - startTime;
        console.log('[check-expired-subscriptions] Performance timings:', JSON.stringify(timings, null, 2));
        return NextResponse.json<ApiData<CheckExpiredSubscriptionsResponseDto>>({
            success: true,
            message: "没有发现过期的订阅",
            data: {
                expiredCount: 0,
                refreshedCount: 0,
                expiredSubscriptionIds: [],
            },
        });
    }

    const candidateIds = candidates.map((c: any) => c.id);
    const toExpire: Array<{ id: string; end_date: string }> = [];
    const toRefresh: Array<{ id: string; end_date: string }> = [];
    const toAutoCancelByModel: Array<{ id: string; student_id: string | null }> = [];

    // 3. 查询计划实例
    const instancesStart = performance.now();
    // Load latest plan instance per subscription (needed for credit scope)
    const { data: instances } = await supabase
        .from("coach_plan_instances")
        .select("id, coach_subscription_id, training_days, start_execution_day, created_at, status, entitlement_consumption_policy")
        .in("coach_subscription_id", candidateIds)
        .in("status", ["active", "paused", "completed", "scheduled", "archived"])
        .order("created_at", { ascending: false });
    timings['3_query_instances'] = performance.now() - instancesStart;

    // 4. 处理实例映射
    const instanceMapStart = performance.now();
    const latestInstanceBySub = new Map<string, any>();
    for (const inst of (instances || []) as any[]) {
        const sid = inst?.coach_subscription_id;
        if (!sid) continue;
        if (String(inst?.status || "").toLowerCase() === "archived") continue;
        if (!latestInstanceBySub.has(sid)) latestInstanceBySub.set(sid, inst);
    }
    timings['4_build_instance_map'] = performance.now() - instanceMapStart;

    // 5. 查询执行记录
    const executionsStart = performance.now();
    const instanceIds = ((instances || []) as any[]).map((i: any) => i.id).filter(Boolean);
    const { data: completedExecs } = instanceIds.length > 0
        ? await supabase
            .from("plan_instance_executions")
            .select("instance_id, day_index, status, started_at, completed_at, created_at")
            .in("instance_id", instanceIds)
            .eq("status", "completed")
        : { data: [] as any[] };
    timings['5_query_executions'] = performance.now() - executionsStart;

    // 6. 处理执行记录映射
    const executionMapStart = performance.now();
    const execsByInstance = new Map<string, any[]>();
    (completedExecs || []).forEach((e: any) => {
        const arr = execsByInstance.get(e.instance_id) || [];
        arr.push(e);
        execsByInstance.set(e.instance_id, arr);
    });
    timings['6_build_execution_map'] = performance.now() - executionMapStart;

    // 7. 计算 credits（循环处理每个订阅）
    const creditsCalcStart = performance.now();
    for (const sub of candidates as any[]) {
        const weeks = Number(sub?.subscribed_weeks || 0);
        if (!weeks || weeks <= 0) continue;

        const inst = latestInstanceBySub.get(sub.id);
        if (!inst?.training_days) continue;

        const subInstances = (instances || []).filter((item: any) =>
            item?.coach_subscription_id === sub.id
        );
        const carryover = deriveSubscriptionCarryoverSummaryFromHistory({
            subscribedWeeks: weeks,
            instances: subInstances as any[],
            executions: (completedExecs || []) as any[],
            excludeInstanceId: String(inst.id || ""),
            createdBefore: inst.created_at || null,
            subscriptionStartDate: sub?.start_date || null,
        });

        const instanceExecutions = ((execsByInstance.get(inst.id) || []) as any[]).map((e) => ({
            day_index: e.day_index,
            status: e.status,
            completed_at: e.completed_at || null,
            updated_at: e.updated_at || null,
            started_at: e.started_at || null,
            created_at: e.created_at || null,
        }));

        const model = deriveSubscriptionEntitlementState({
            subscription: sub,
            planInstance: inst,
            executions: instanceExecutions as any[],
            effectiveSubscribedWeeks: carryover.remainingWeeks,
            now: new Date(nowIso),
        });

        if (model.totalCredits <= 0) {
            // Nothing to consume; do not expire.
            continue;
        }

        if (model.remainingCredits === 0) {
            toExpire.push({
                id: sub.id,
                end_date: model.displayEndDate || nowIso,
            });
            if (model.shouldAutoCancel) {
                toAutoCancelByModel.push({
                    id: sub.id,
                    student_id: sub.student_id || null,
                });
            }
            continue;
        }

        // Estimate end_date for friendly UI "剩余X天" display
        if (model.displayEndDate) {
            toRefresh.push({ id: sub.id, end_date: model.displayEndDate });
        }
    }
    timings['7_calculate_credits'] = performance.now() - creditsCalcStart;
    timings['7a_candidates_count'] = candidates.length;
    timings['7b_to_expire_count'] = toExpire.length;
    timings['7c_to_refresh_count'] = toRefresh.length;

    // 8. 更新刷新订阅
    const updateRefreshStart = performance.now();
    if (toRefresh.length > 0) {
        const refreshPayload = toRefresh.map((r) => ({
            id: r.id,
            end_date: r.end_date,
            updated_at: nowIso,
        }));
        await supabase
            .from("coach_subscriptions")
            .upsert(refreshPayload as any, { onConflict: "id" });
    }
    timings['8_update_refresh'] = performance.now() - updateRefreshStart;

    // 9. 更新新到期订阅（进入宽限期）
    const updateExpireStart = performance.now();
    if (toExpire.length > 0) {
        // Do not update status (DB constraint). Instead, set end_date to now so UI shows "已到期/已结束".
        const expireResults = await Promise.all(
            toExpire.map((item) =>
                supabase
                    .from("coach_subscriptions")
                    .update({
                        end_date: item.end_date,
                        updated_at: nowIso,
                    })
                    .eq("id", item.id),
            ),
        );

        const updateError = expireResults.find((result) => result.error)?.error;

        if (updateError) {
            console.error("更新订阅结束时间失败:", updateError);
            timings['total'] = performance.now() - startTime;
            console.log('[check-expired-subscriptions] Performance timings:', JSON.stringify(timings, null, 2));
            return NextResponse.json<ApiData<CheckExpiredSubscriptionsResponseDto>>({
                success: false,
                message: "更新订阅结束时间失败",
                data: null,
            }, { status: 500 });
        }

        // 10. 更新用户邀请教练ID
        const updateUsersStart = performance.now();
        const studentIds = (candidates as any[])
            .filter((c) => toAutoCancelByModel.some((item) => item.id === c.id))
            .map((c) => c.student_id);

        // 同时清空这些学生的 invitation_coach_id
        const { error: userUpdateError } = await supabase
            .from("users")
            .update({
                invitation_coach_id: null,
            })
            .in("id", studentIds);

        if (userUpdateError) {
            console.error("更新用户邀请教练ID失败:", userUpdateError);
        }
        timings['10_update_users'] = performance.now() - updateUsersStart;
    }
    timings['9_update_expire'] = performance.now() - updateExpireStart;

    // 9b. 超过宽限期自动取消订阅关系
    const autoCancelStart = performance.now();
    let cancelledCount = 0;
    try {
        const toCancel = toAutoCancelByModel;

        if (toCancel.length > 0) {
            const cancelIds = toCancel.map((r: any) => r.id).filter(Boolean);
            const cancelStudentIds = toCancel
                .map((r: any) => r.student_id)
                .filter(Boolean);

            const { error: cancelError } = await supabase
                .from("coach_subscriptions")
                .update({
                    status: "cancelled",
                    updated_at: nowIso,
                })
                .in("id", cancelIds);

            if (!cancelError) {
                cancelledCount = cancelIds.length;
            }

            if (cancelStudentIds.length > 0) {
                await supabase
                    .from("users")
                    .update({
                        invitation_coach_id: null,
                    })
                    .in("id", cancelStudentIds);
            }
        }
    } catch (e) {
        console.error("自动取消超宽限订阅失败:", e);
    }
    timings["9b_auto_cancel"] = performance.now() - autoCancelStart;

    // 计算总耗时
    timings['total'] = performance.now() - startTime;

    // 输出性能日志
    if (process.env.NODE_ENV === 'development' || timings['total'] > 1000) {
        console.log('[check-expired-subscriptions] Performance timings:', JSON.stringify(timings, null, 2));
    }

    return NextResponse.json<ApiData<CheckExpiredSubscriptionsResponseDto>>({
        success: true,
        message:
            `成功处理了 ${toExpire.length} 个订阅（进入宽限 ${toExpire.length}，刷新 ${toRefresh.length} 个预计完成日，自动取消 ${cancelledCount}）`,
        data: {
            expiredCount: toExpire.length,
            refreshedCount: toRefresh.length,
            expiredSubscriptionIds: toExpire.map((item) => item.id),
        },
    });
}
