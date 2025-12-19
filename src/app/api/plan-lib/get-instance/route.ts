import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { GetInstanceDto, GetInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const {
        id,
        subscriptionId,
    } = await req.json() as GetInstanceDto;

    if (!id && !subscriptionId) {
        return NextResponse.json({
            success: false,
            message: "Invalid parameters",
        });
    }

    let query = supabase
        .from("coach_plan_instances")
        .select("*");

    if (id) {
        query = query.eq("id", id);
    }

    if (subscriptionId) {
        query = query.eq("coach_subscription_id", subscriptionId);
    }

    // 获取计划实例
    const { data: instance, error } = await query.maybeSingle();

    if (!instance) {
        return NextResponse.json({
            success: true,
            message: "No plan instance found",
            data: {
                instance: null,
            },
        });
    }

    if (error) {
        console.error("Error fetching instance:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch instance",
        }, { status: 500 });
    }

    // 检查用户权限（教练或学员都可以查看）

    if (session.user.is_coach) {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", instance.coach_id)
            .single();

        if (coach.user_id !== userId) {
            return NextResponse.json({
                success: false,
                message: "无权限查看该教练",
            }, { status: 403 });
        }
    } else {
        // 学员权限检查：优先检查 student_id，如果没有则通过 subscription 验证
        if (instance.student_id) {
            if (instance.student_id !== userId) {
                return NextResponse.json({
                    success: false,
                    message: "权限不足",
                }, { status: 403 });
            }
        } else if (instance.coach_subscription_id) {
            // 通过 subscription 验证学员权限
            const { data: subscription, error: subError } = await supabase
                .from("coach_subscriptions")
                .select("student_id")
                .eq("id", instance.coach_subscription_id)
                .single();

            if (
                subError || !subscription || subscription.student_id !== userId
            ) {
                return NextResponse.json({
                    success: false,
                    message: "权限不足",
                }, { status: 403 });
            }
        } else {
            return NextResponse.json({
                success: false,
                message: "权限不足",
            }, { status: 403 });
        }
    }

    // 为学员端加载动作详情
    let actionsMap: Record<string, any> = {};
    if (!session.user.is_coach && instance.training_days) {
        const trainingDays = instance.training_days as any[];
        const actionIds = new Set<string>();

        // 收集所有 action_id（兼容 actionId 和 action_id 两种字段名）
        trainingDays.forEach((day: any) => {
            day.actionSets?.forEach((set: any) => {
                // 支持两种字段名: action_id 和 actionId
                const actionId = set.action_id || set.actionId;
                if (actionId) {
                    actionIds.add(actionId);
                }
            });
        });

        // 批量获取动作详情
        if (actionIds.size > 0) {
            const { data: actions } = await supabase
                .from("coach_actions")
                .select("*")
                .in("id", Array.from(actionIds));

            if (actions) {
                actions.forEach((action) => {
                    actionsMap[action.id] = action;
                });
            }
        }
    }

    return NextResponse.json<ApiData<any>>({
        success: true,
        message: "获取训练计划实例成功",
        data: {
            instance,
            actions: Object.keys(actionsMap).length > 0
                ? actionsMap
                : undefined,
        },
    });
}
