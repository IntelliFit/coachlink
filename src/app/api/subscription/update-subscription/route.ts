import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    UpdateSubscriptionDto,
    UpdateSubscriptionResponseDto,
} from "./entity";
import { sendSystemMessage } from "@/lib/chat";
import { autoMatchPlanForSubscription } from "@/app/api/plan-lib/auto-match-plan/service";
import { supportsOfflinePaymentForCoach } from "@/lib/offlinePaymentPolicy";
import { refreshSubscriptionEntitlementSnapshot } from "@/lib/subscriptionEntitlementSnapshot";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 通过 session 获取用户 ID
    const userId = session.user.id;

    const {
        id,
        ...updateData
    } = await req.json() as UpdateSubscriptionDto;

    // 参数验证 - 必须提供订阅ID
    if (!id) {
        return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
            success: false,
            message: "缺少订阅ID",
            data: null,
        }, { status: 400 });
    }

    // 检查订阅是否存在且属于当前用户
    const { data: subscription, error: subscriptionError } = await supabase
        .from("coach_subscriptions")
        .select("*")
        .eq("id", id)
        .single();

    if (subscriptionError || !subscription) {
        return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
            success: false,
            message: "指定的订阅不存在",
            data: null,
        }, { status: 404 });
    }

    // 验证用户权限（必须是学生、教练或管理员）
    const isAdmin = session.user.is_admin === true;

    // 计算当前用户对应的 coach_id（coaches.id），用于教练权限判断
    let coachIdForSession: string | null = null;
    if (session.user.is_coach) {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .single();
        if (!coachError && coach?.id) coachIdForSession = coach.id;
    }

    const isStudentOfSubscription = subscription.student_id === userId;
    const isCoachOfSubscription = coachIdForSession !== null && subscription.coach_id === coachIdForSession;

    if (!isAdmin && !isStudentOfSubscription && !isCoachOfSubscription) {
        return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
            success: false,
            message: "无权修改此订阅",
            data: null,
        }, { status: 403 });
    }

    const requestedStatus = String((updateData as any)?.status || "").toLowerCase();
    const allowsExplicitLifecycleEndDate =
        requestedStatus === "cancelled" || requestedStatus === "expired";
    if (!allowsExplicitLifecycleEndDate && Object.prototype.hasOwnProperty.call(updateData, "end_date")) {
        delete (updateData as any).end_date;
    }

    // 线下支付仅允许白名单教练（枭马葛 / 刘三乐）。
    const requestedPaymentMethod = String((updateData as any)?.payment_method || "")
        .trim()
        .toLowerCase();
    const paymentData = (updateData as any)?.payment_data;
    const hasOfflinePaymentPayload = Boolean(
        requestedPaymentMethod === "offline" ||
        (
            paymentData &&
            typeof paymentData === "object" &&
            !Array.isArray(paymentData) &&
            (
                (paymentData as any)?.offline_payment ||
                String((paymentData as any)?.payment_type || "").toLowerCase() === "offline"
            )
        )
    );

    if (hasOfflinePaymentPayload) {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("name, title")
            .eq("id", subscription.coach_id)
            .single();

        if (coachError || !coach) {
            return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
                success: false,
                message: "无法校验教练支付策略，请稍后重试",
                data: null,
            }, { status: 500 });
        }

        const coachName = String((coach as any).name || (coach as any).title || "").trim();
        const allowOfflinePayment = supportsOfflinePaymentForCoach({ coachName });
        if (!allowOfflinePayment) {
            return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
                success: false,
                message: "该教练仅支持线上支付，暂不支持线下已付提交",
                data: null,
            }, { status: 403 });
        }
    }

    // 防止管理员后台“手动确认支付”这类不合理流程：管理员不能改订阅状态
    if (isAdmin && typeof (updateData as any)?.status !== "undefined") {
        return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
            success: false,
            message: "管理员不允许修改订阅状态（支付确认必须在系统与教练之间闭环）",
            data: null,
        }, { status: 403 });
    }

    // 仅允许学员提交“待确认”（个人收款码/线下），不允许学员直接激活
    if (typeof (updateData as any)?.status !== "undefined") {
        const nextStatus = (updateData as any).status as string;
        if (nextStatus === "waiting") {
            if (!isStudentOfSubscription) {
                return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
                    success: false,
                    message: "只有学员可以提交待确认",
                    data: null,
                }, { status: 403 });
            }
        }

        if (nextStatus === "active") {
            if (!isCoachOfSubscription) {
                return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
                    success: false,
                    message: "只有教练可以确认并激活订阅",
                    data: null,
                }, { status: 403 });
            }
            if (subscription.status !== "waiting") {
                return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
                    success: false,
                    message: "仅允许从待确认状态激活订阅",
                    data: null,
                }, { status: 400 });
            }

            // 教练确认：写入确认元信息（平台支付由系统写入，不走这里）
            const nowIso = new Date().toISOString();
            (updateData as any).payment_confirmed_by = "coach";
            (updateData as any).payment_confirmed_at = nowIso;

            // 兜底处理续费确认：即使前端未传，也根据 pending_renew 自动生效。
            const existingPaymentData =
                (subscription as any)?.payment_data &&
                typeof (subscription as any).payment_data === "object" &&
                !Array.isArray((subscription as any).payment_data)
                    ? ((subscription as any).payment_data as Record<string, any>)
                    : null;

            const pendingRenew =
                existingPaymentData &&
                typeof existingPaymentData.pending_renew === "object" &&
                !Array.isArray(existingPaymentData.pending_renew)
                    ? (existingPaymentData.pending_renew as { additional_weeks?: number })
                    : null;

            const renewWeeks = Number(pendingRenew?.additional_weeks || 0);
            const now = new Date(nowIso);

            if (renewWeeks > 0) {
                const currentWeeks = Number(subscription.subscribed_weeks || 0);
                const expectedWeeks = currentWeeks + renewWeeks;
                const requestedWeeks = Number((updateData as any).subscribed_weeks || 0);
                (updateData as any).subscribed_weeks = Math.max(expectedWeeks, requestedWeeks || 0);

            }

            // 兼容“老订阅重开”场景：若确认激活但未明确设置 end_date，清理陈旧到期时间，避免刚确认就被判定为过期。
            if (typeof (updateData as any).end_date === "undefined") {
                const oldEndDate = subscription.end_date ? new Date(subscription.end_date) : null;
                const hasStaleEndDate = Boolean(oldEndDate && oldEndDate.getTime() <= now.getTime());
                if (!subscription.start_date || hasStaleEndDate) {
                    (updateData as any).end_date = null;
                }
            }

            const incomingPaymentData =
                (updateData as any)?.payment_data &&
                typeof (updateData as any).payment_data === "object" &&
                !Array.isArray((updateData as any).payment_data)
                    ? ((updateData as any).payment_data as Record<string, any>)
                    : null;
            let mergedPaymentData = incomingPaymentData || existingPaymentData;

            // 兼容线下续费：如果没有 pending_renew，但有 offline_payment.expires_at，按到期日折算补周数（仅一次）。
            if (
                mergedPaymentData &&
                !mergedPaymentData.offline_renew_applied_at &&
                renewWeeks <= 0
            ) {
                const offlinePayment =
                    mergedPaymentData.offline_payment &&
                    typeof mergedPaymentData.offline_payment === "object" &&
                    !Array.isArray(mergedPaymentData.offline_payment)
                        ? mergedPaymentData.offline_payment
                        : null;
                const offlineExpiresAt = offlinePayment?.expires_at
                    ? new Date(offlinePayment.expires_at)
                    : null;

                if (offlineExpiresAt && !Number.isNaN(offlineExpiresAt.getTime()) && offlineExpiresAt.getTime() > now.getTime()) {
                    const baseDate = now;
                    const inferredWeeks = Math.max(
                        0,
                        Math.ceil((offlineExpiresAt.getTime() - baseDate.getTime()) / (7 * 24 * 60 * 60 * 1000)),
                    );

                    if (inferredWeeks > 0) {
                        const currentWeeks = Number(subscription.subscribed_weeks || 0);
                        const requestedWeeks = Number((updateData as any).subscribed_weeks || 0);
                        (updateData as any).subscribed_weeks = Math.max(
                            currentWeeks + inferredWeeks,
                            requestedWeeks || 0,
                        );
                    }

                    mergedPaymentData = {
                        ...mergedPaymentData,
                        offline_renew_applied_at: nowIso,
                    };
                }
            }

            if (mergedPaymentData) {
                (updateData as any).payment_data = {
                    ...mergedPaymentData,
                    pending_renew: null,
                };
            }
        }
    }

    // 更新订阅记录
    const { data: updatedSubscription, error: updateError } = await supabase
        .from("coach_subscriptions")
        .update({
            ...updateData,
        })
        .eq("id", id)
        .select()
        .single();

    // 如果需要的可以提醒教练
    if (updateData.has_remind_coach) {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", subscription.coach_id)
            .single();

        if (coachError) {
            return NextResponse.json({
                success: false,
                message: coachError.message,
                data: null,
            }, { status: 500 });
        }

        const ok = await sendSystemMessage(coach.user_id, {
            content:
                `新的学员订阅来了！请前往 [我的学员](/dashboard/students) 查看，并在右上角【待支付确认】中确认收款。`,
        });

        if (!ok) {
            return NextResponse.json({
                success: false,
                message: "更新订阅失败",
                data: null,
            }, { status: 500 });
        }
    }

    if (updateError || !updatedSubscription) {
        return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
            success: false,
            message: "更新订阅失败: " +
                (updateError?.message || "Unknown error"),
            data: null,
        }, { status: 500 });
    }

    // 教练手动确认支付并激活后，自动尝试匹配计划；失败时明确提示教练手动创建。
    const entitlementModel = await refreshSubscriptionEntitlementSnapshot(id);
    const responseSubscription = entitlementModel
        ? { ...updatedSubscription, end_date: entitlementModel.displayEndDate || null }
        : updatedSubscription;

    if ((updateData as any)?.status === "active" && isCoachOfSubscription) {
        const matchRes = await autoMatchPlanForSubscription(id, userId, subscription.coach_id);
        const matchMsg = matchRes.success
            ? "系统已自动匹配训练计划，学员将在约2分钟后看到计划。"
            : `自动匹配失败（${matchRes.reason || "未知原因"}），请在学员页手动创建计划。`;
        await sendSystemMessage(userId, {
            content: `该学员订阅的计划分配结果：${matchMsg}`,
        });
    }

    // 重要！必须申请接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdateSubscriptionResponseDto>>({
        success: true,
        message: "订阅更新成功",
        // UpdateSubscriptionResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            subscription: responseSubscription,
        },
    });
}
