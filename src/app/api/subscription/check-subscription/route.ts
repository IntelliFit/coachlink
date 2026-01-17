import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CheckSubscriptionDto,
    CheckSubscriptionResponseDto,
} from "./entity";

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
        // 检查所有已过期的订阅并更新状态
        const now = new Date().toISOString();

        // NOTE: coach subscription end_date is "pause-aware" (auto-extended on gap days).
        // Here we first fetch candidates by stored end_date < now, then recompute effective end_date.
        // If effective end_date is still < now => expire; otherwise => refresh end_date.
        const { data: candidates, error } = await supabase
            .from("coach_subscriptions")
            .select("id, student_id, coach_id, status, start_date, end_date, subscribed_weeks")
            .lt("end_date", now)  // 结束日期小于当前时间（候选）
            .neq("status", "expired")  // 状态还不是过期
            .neq("status", "cancelled")  // 排除已取消的订阅

        if (error) {
            console.error("检查过期订阅失败:", error);
            return NextResponse.json({
                success: false,
                message: "检查过期订阅失败",
                data: null,
            }, { status: 500 });
        }

        if (candidates && candidates.length > 0) {
            const now0 = new Date();
            now0.setHours(0, 0, 0, 0);

            const candidateIds = candidates.map((c: any) => c.id);
            const { data: instances } = await supabase
                .from("coach_plan_instances")
                .select("id, coach_subscription_id")
                .in("coach_subscription_id", candidateIds);

            const instanceToSub = new Map<string, string>();
            (instances || []).forEach((r: any) => {
                if (r?.id && r?.coach_subscription_id) instanceToSub.set(r.id, r.coach_subscription_id);
            });

            const allInstanceIds = Array.from(new Set((instances || []).map((r: any) => r.id).filter(Boolean)));
            const subToActiveDayKeys = new Map<string, Set<string>>();

            if (allInstanceIds.length > 0) {
                const { data: execs } = await supabase
                    .from("plan_instance_executions")
                    .select("instance_id, started_at, status")
                    .in("instance_id", allInstanceIds)
                    .neq("status", "abandoned");

                (execs || []).forEach((e: any) => {
                    const subId = instanceToSub.get(e.instance_id);
                    if (!subId) return;
                    const startedAt = e.started_at ? new Date(e.started_at) : null;
                    if (!startedAt) return;
                    startedAt.setHours(0, 0, 0, 0);
                    const key = startedAt.toISOString().slice(0, 10);
                    const set = subToActiveDayKeys.get(subId) || new Set<string>();
                    set.add(key);
                    subToActiveDayKeys.set(subId, set);
                });
            }

            const toExpire: string[] = [];
            const toRefresh: Array<{ id: string; end_date: string }> = [];

            for (const sub of candidates as any[]) {
                if (!sub?.start_date || !sub?.subscribed_weeks) {
                    // no pause-aware window → fall back to expire
                    toExpire.push(sub.id);
                    continue;
                }

                const start0 = new Date(sub.start_date);
                start0.setHours(0, 0, 0, 0);
                const totalDays = Number(sub.subscribed_weeks) * 7;
                const diffDays = Math.floor((now0.getTime() - start0.getTime()) / (1000 * 60 * 60 * 24));
                const daysSinceStart = Math.max(1, diffDays + 1);
                const activeDays = (subToActiveDayKeys.get(sub.id) || new Set<string>()).size;
                const pausedDays = Math.max(0, daysSinceStart - activeDays);

                const effectiveEnd = new Date(start0);
                effectiveEnd.setDate(effectiveEnd.getDate() + totalDays + pausedDays);

                if (effectiveEnd.getTime() < new Date().getTime()) {
                    toExpire.push(sub.id);
                } else {
                    toRefresh.push({ id: sub.id, end_date: effectiveEnd.toISOString() });
                }
            }

            if (toRefresh.length > 0) {
                // best-effort refresh end_date to effective one, to avoid false expirations later
                await Promise.all(
                    toRefresh.map((r) =>
                        supabase
                            .from("coach_subscriptions")
                            .update({ end_date: r.end_date, updated_at: now })
                            .eq("id", r.id),
                    ),
                );
            }

            if (toExpire.length > 0) {
                const { error: updateError } = await supabase
                    .from("coach_subscriptions")
                    .update({
                        status: "expired",
                        updated_at: now,
                    })
                    .in("id", toExpire);

                if (updateError) {
                    console.error("更新过期订阅状态失败:", updateError);
                    return NextResponse.json({
                        success: false,
                        message: "更新过期订阅状态失败",
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
                message: `成功处理了 ${toExpire.length} 个过期订阅（刷新 ${toRefresh.length} 个订阅到期日）`,
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
