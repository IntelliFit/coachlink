import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { GetCurrentResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 获取学员当前正在执行的计划
 *
 * 逻辑：
 * 1. 查询 status = 'active' 的唯一计划
 * 2. 若存在 status = 'scheduled' 且 start_date <= today 的计划，自动激活
 * 3. 返回计划详情和关联的动作信息
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    // 1. 检查是否有 scheduled 计划需要激活
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const { data: scheduledPlans } = await supabase
        .from("coach_plan_instances")
        .select("id")
        .eq("student_id", userId)
        .eq("status", "scheduled")
        .lte("start_date", today);

    // 如果有 scheduled 计划到期，触发状态流转
    if (scheduledPlans && scheduledPlans.length > 0) {
        // 先将当前 active 计划设为 completed
        await supabase
            .from("coach_plan_instances")
            .update({
                status: "completed",
                updated_at: new Date().toISOString(),
            })
            .eq("student_id", userId)
            .eq("status", "active");

        // 将第一个 scheduled 计划激活
        await supabase
            .from("coach_plan_instances")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("id", scheduledPlans[0].id);
    }

    // 2. 获取当前 active 计划
    const { data: instance, error } = await supabase
        .from("coach_plan_instances")
        .select("*")
        .eq("student_id", userId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Error fetching current plan:", error);
        return NextResponse.json({
            success: false,
            message: `获取当前计划失败: ${error.message}`,
        }, { status: 500 });
    }

    // 无 active 计划
    if (!instance) {
        return NextResponse.json<ApiData<GetCurrentResponseDto>>({
            success: true,
            message: "暂无进行中的计划",
            data: {
                instance: null,
                message: "暂无进行中的计划，请等待教练分配或创建自己的计划",
            },
        });
    }

    // 3. 加载动作详情
    let actionsMap: Record<string, any> = {};
    if (instance.training_days) {
        const trainingDays = instance.training_days as any[];
        const actionIds = new Set<string>();

        // 收集所有 action_id
        trainingDays.forEach((day: any) => {
            day.actionSets?.forEach((set: any) => {
                const actionId = set.action_id || set.actionId;
                if (actionId) {
                    actionIds.add(actionId);
                }
            });
        });

        // 批量获取动作详情
        if (actionIds.size > 0) {
            const idsList = Array.from(actionIds);

            // 查教练动作库
            const { data: coachActions } = await supabase
                .from("coach_actions")
                .select("*")
                .in("id", idsList);

            if (coachActions) {
                coachActions.forEach((action) => {
                    actionsMap[action.id] = action;
                });
            }

            // 查学员动作库
            const remainingIds = idsList.filter((id) => !actionsMap[id]);
            if (remainingIds.length > 0) {
                const { data: studentActions } = await supabase
                    .from("student_actions")
                    .select("*")
                    .in("id", remainingIds);

                if (studentActions) {
                    studentActions.forEach((action) => {
                        actionsMap[action.id] = {
                            ...action,
                            video_url: action.url,
                            is_student_action: true,
                        };
                    });
                }
            }
        }
    }

    return NextResponse.json<ApiData<GetCurrentResponseDto>>({
        success: true,
        message: "获取当前计划成功",
        data: {
            instance,
            actions: Object.keys(actionsMap).length > 0
                ? actionsMap
                : undefined,
        },
    });
}
