import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CheckSubscriptionDto,
    CheckSubscriptionResponseDto,
} from "./entity";
import { authorizeMaintenanceRequest } from "@/lib/maintenanceAuth";
import { runSubscriptionExpiryCheckOnce } from "@/lib/subscriptionExpiryCheck";

const EXPIRY_SECRET_ENV = "SUBSCRIPTION_EXPIRY_CRON_SECRET";

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
    // Manual trigger for the shared expiry job; scheduled runs happen in-process
    // (src/instrumentation-node.ts). Admins (or the cron secret) only.
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "check-expired") {
        const auth = await authorizeMaintenanceRequest(req, EXPIRY_SECRET_ENV);
        if (auth.ok === false) {
            return NextResponse.json({ success: false, message: auth.message, data: null }, { status: auth.status });
        }

        const result = await runSubscriptionExpiryCheckOnce();
        if (result.ok === false) {
            return NextResponse.json({
                success: false,
                message: result.stage === "write" ? result.message : `暂时无法核对订阅数据，未调整订阅（${result.message}）`,
                data: null,
            }, { status: result.stage === "write" ? 500 : 503 });
        }

        return NextResponse.json({
            success: true,
            message: result.expiredCount + result.refreshedCount === 0
                ? "没有发现过期的订阅"
                : `成功处理了 ${result.expiredCount} 个订阅（进入宽限 ${result.expiredCount}，刷新 ${result.refreshedCount} 个预计完成日，自动取消 ${result.cancelledCount}，待人工核对 ${result.heldForReviewIds.length}）`,
            data: {
                expiredCount: result.expiredCount,
                refreshedCount: result.refreshedCount,
                expiredSubscriptionIds: result.expiredSubscriptionIds,
            },
        });
    }

    return NextResponse.json({
        success: false,
        message: "无效的操作",
        data: null,
    }, { status: 400 });
}
