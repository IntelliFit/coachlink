import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CheckSubscriptionDto,
    CheckSubscriptionResponseDto,
} from "./entity";
import { computeCreditsScope, computeUsedCredits, estimateRemainingDays } from "@/lib/subscriptionCredits";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;

    const {
        subscriptionId,
        reason,
        immediate,
    } = await req.json() as CheckSubscriptionDto;

    // 参数验证
    if (!subscriptionId) {
        return NextResponse.json<ApiData<CheckSubscriptionResponseDto>>({
            success: false,
            message: "缺少订阅ID",
            data: null,
        }, { status: 400 });
    }

    // 获取订阅信息
    const { data: subscription, error: subError } = await supabase
        .from("coach_subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .single();

    if (subError || !subscription) {
        return NextResponse.json<ApiData<CheckSubscriptionResponseDto>>({
            success: false,
            message: "订阅不存在",
            data: null,
        }, { status: 404 });
    }

    // 验证权限（必须是订阅的学生或相关的教练或管理员）
    const isAdmin = session.user.is_admin === true;

    let isStudentOfSubscription = false;
    let isCoachOfSubscription = false;

    if (subscription.student_id === userId) {
        isStudentOfSubscription = true;
    }

    // 检查是否是相关教练
    if (subscription.coach_id) {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .single();

        if (!coachError && coach?.id === subscription.coach_id) {
            isCoachOfSubscription = true;
        }
    }

    // 只有学生本人、相关教练或管理员可以取消订阅
    if (!isAdmin && !isStudentOfSubscription && !isCoachOfSubscription) {
        return NextResponse.json<ApiData<CheckSubscriptionResponseDto>>({
            success: false,
            message: "无权取消此订阅",
            data: null,
        }, { status: 403 });
    }

    // 准备更新数据
    const updateData: any = {
        status: "cancelled",
        updated_at: new Date().toISOString(),
    };

    // 如果是立即取消，设置结束日期为当前时间
    if (immediate) {
        updateData.end_date = new Date().toISOString();
    }

    // 如果提供了取消原因，也保存下来
    if (reason) {
        updateData.cancellation_reason = reason;
    }

    // 更新订阅状态
    const { data: updatedSubscription, error: updateError } = await supabase
        .from("coach_subscriptions")
        .update(updateData)
        .eq("id", subscriptionId)
        .select()
        .single();

    if (updateError || !updatedSubscription) {
        console.error("取消订阅失败:", updateError);
        return NextResponse.json<ApiData<CheckSubscriptionResponseDto>>({
            success: false,
            message: "取消订阅失败",
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<CheckSubscriptionResponseDto>>({
        success: true,
        message: "订阅已成功取消",
        data: {
            subscription: updatedSubscription,
        },
    });
}

export async function PUT(req: Request) {
    // 处理订阅到期逻辑 - 这个端点可以由定时任务调用，检查所有订阅的到期情况
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'check-expired') {
        // B1: 按“训练日次数 credits”判断订阅是否到期（次数用完才过期）。
        // end_date 仅用于 UI 显示的“预计完成日”，不是硬日历到期。
        const nowIso = new Date().toISOString();

        // Fetch active candidates (started only); cancelled/expired ignored.
        // NOTE: start_date is set at first execution start.
        const { data: candidates, error } = await supabase
            .from("coach_subscriptions")
            .select("id, student_id, coach_id, status, start_date, subscribed_weeks")
            .eq("status", "active")
            .not("start_date", "is", null)
            .gt("subscribed_weeks", 0);

        if (error) {
            console.error("检查过期订阅失败:", error);
            return NextResponse.json({
                success: false,
                message: "检查过期订阅失败",
                data: null,
            }, { status: 500 });
        }

        if (candidates && candidates.length > 0) {
            const candidateIds = candidates.map((c: any) => c.id);
            const toExpire: string[] = [];
            const toRefresh: Array<{ id: string; end_date: string }> = [];

            // Load latest plan instance per subscription (needed for credit scope)
            const { data: instances } = await supabase
                .from("coach_plan_instances")
                .select("id, coach_subscription_id, training_days, start_execution_day, created_at, status")
                .in("coach_subscription_id", candidateIds)
                .order("created_at", { ascending: false });

            const latestInstanceBySub = new Map<string, any>();
            for (const inst of (instances || []) as any[]) {
                const sid = inst?.coach_subscription_id;
                if (!sid) continue;
                if (!latestInstanceBySub.has(sid)) latestInstanceBySub.set(sid, inst);
            }

            const instanceIds = Array.from(latestInstanceBySub.values()).map((i: any) => i.id).filter(Boolean);
            const { data: completedExecs } = instanceIds.length > 0
                ? await supabase
                    .from("plan_instance_executions")
                    .select("instance_id, day_index, status")
                    .in("instance_id", instanceIds)
                    .eq("status", "completed")
                : { data: [] as any[] };

            const execsByInstance = new Map<string, any[]>();
            (completedExecs || []).forEach((e: any) => {
                const arr = execsByInstance.get(e.instance_id) || [];
                arr.push(e);
                execsByInstance.set(e.instance_id, arr);
            });

            for (const sub of candidates as any[]) {
                const weeks = Number(sub?.subscribed_weeks || 0);
                if (!weeks || weeks <= 0) continue;

                const inst = latestInstanceBySub.get(sub.id);
                if (!inst?.training_days) continue;

                const scope = computeCreditsScope({
                    trainingDays: (inst.training_days as any[]) || [],
                    startExecutionDay: Number(inst.start_execution_day || 1),
                    subscribedWeeks: weeks,
                });

                const totalCredits = scope.totalCredits;
                if (totalCredits <= 0) {
                    // Nothing to consume; do not expire.
                    continue;
                }

                const usedCredits = computeUsedCredits({
                    eligibleTrainingDayIndexSet: scope.eligibleTrainingDayIndexSet,
                    executions: ((execsByInstance.get(inst.id) || []) as any[]).map((e) => ({
                        day_index: e.day_index,
                        status: e.status,
                    })),
                    startExecutionDay: Number(inst.start_execution_day || 1),
                });

                const remainingCredits = Math.max(0, totalCredits - usedCredits);
                if (remainingCredits === 0) {
                    toExpire.push(sub.id);
                    continue;
                }

                // Estimate end_date for friendly UI “剩余X天” display
                const remainingDaysEstimate = estimateRemainingDays({
                    subscribedWeeks: weeks,
                    totalCredits,
                    remainingCredits,
                    fallbackCreditsPerWeek: 3,
                });
                const end = new Date();
                end.setDate(end.getDate() + remainingDaysEstimate);
                toRefresh.push({ id: sub.id, end_date: end.toISOString() });
            }

            if (toRefresh.length > 0) {
                await Promise.all(
                    toRefresh.map((r) =>
                        supabase
                            .from("coach_subscriptions")
                            .update({ end_date: r.end_date, updated_at: nowIso })
                            .eq("id", r.id),
                    ),
                );
            }

            if (toExpire.length > 0) {
                // Do not update status (DB constraint). Instead, set end_date to now so UI shows “已到期/已结束”.
                const { error: updateError } = await supabase
                    .from("coach_subscriptions")
                    .update({
                        end_date: nowIso,
                        updated_at: nowIso,
                    })
                    .in("id", toExpire);

                if (updateError) {
                    console.error("更新订阅结束时间失败:", updateError);
                    return NextResponse.json({
                        success: false,
                        message: "更新订阅结束时间失败",
                        data: null,
                    }, { status: 500 });
                }

                const studentIds = (candidates as any[])
                    .filter((c) => toExpire.includes(c.id))
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
            }

            return NextResponse.json({
                success: true,
                message: `成功处理了 ${toExpire.length} 个订阅（结束 ${toExpire.length}，刷新 ${toRefresh.length} 个预计完成日）`,
                data: {
                    expiredCount: toExpire.length,
                    refreshedCount: toRefresh.length,
                    expiredSubscriptionIds: toExpire,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: "没有发现过期的订阅",
            data: {
                processedCount: 0,
                subscriptionIds: [],
            },
        });
    }

    return NextResponse.json({
        success: false,
        message: "无效的操作",
        data: null,
    }, { status: 400 });
}
