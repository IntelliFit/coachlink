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
            (updateData as any).payment_confirmed_by = "coach";
            (updateData as any).payment_confirmed_at = new Date().toISOString();
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
            subscription: updatedSubscription,
        },
    });
}
