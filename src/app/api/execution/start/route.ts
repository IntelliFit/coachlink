import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { StartExecutionDto, StartExecutionResponseDto } from "../entity";

/**
 * POST /api/execution/start
 *
 * 开始或恢复训练执行
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<StartExecutionResponseDto>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        // 2. 解析请求参数
        const body: StartExecutionDto = await request.json();
        const { instanceId, dayIndex } = body;

        if (!instanceId || !dayIndex) {
            return NextResponse.json<StartExecutionResponseDto>(
                { success: false, message: "缺少必填参数" },
                { status: 400 },
            );
        }

        // 3. 检查今天是否已有执行记录
        const { data: existingExecution } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("instance_id", instanceId)
            .eq("dayIndex", dayIndex)
            .eq("student_id", userId)
            .gte("started_at", new Date().toISOString().split("T")[0]) // 今天开始的
            .neq("status", "abandoned")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingExecution) {
            // 返回现有的执行记录
            return NextResponse.json<StartExecutionResponseDto>({
                success: true,
                data: existingExecution,
            });
        }

        // 4. 获取计划实例和训练日
        const { data: instance, error: instanceError } = await supabase
            .from("coach_plan_instances")
            .select("*, training_days")
            .eq("id", instanceId)
            .single();

        if (instanceError || !instance) {
            return NextResponse.json<StartExecutionResponseDto>(
                { success: false, message: "计划实例不存在" },
                { status: 404 },
            );
        }

        // 5. 验证权限 - 检查学生是否有权访问此计划
        // 方式1: 通过订阅ID验证
        if (instance.coach_subscription_id) {
            const { data: subscription, error: subError } = await supabase
                .from("coach_subscriptions")
                .select("student_id")
                .eq("id", instance.coach_subscription_id)
                .single();

            console.log("Subscription check:", {
                subscription_id: instance.coach_subscription_id,
                subscription,
                subError,
                userId,
            });

            if (subscription && subscription.student_id === userId) {
                // 通过订阅验证
            } else {
                // 方式2: 如果没有找到订阅，检查是否是直接分配给学生的
                const { data: directCheck } = await supabase
                    .from("coach_subscriptions")
                    .select("id")
                    .eq("student_id", userId)
                    .eq("status", "active")
                    .limit(1)
                    .maybeSingle();

                if (!directCheck) {
                    return NextResponse.json<StartExecutionResponseDto>(
                        { success: false, message: "无权访问此计划" },
                        { status: 403 },
                    );
                }
            }
        }

        // 6. 找到对应的训练日
        const trainingDays = instance.training_days as any[];
        const trainingDay = trainingDays.find((d) => d.dayIndex === dayIndex);

        if (!trainingDay) {
            return NextResponse.json<StartExecutionResponseDto>(
                { success: false, message: "训练日不存在" },
                { status: 404 },
            );
        }

        // 7. 获取动作库信息（用于获取真实动作名称）
        const actionSets = trainingDay.actionSets || [];
        const actionIds = actionSets
            .map((a: any) => a.action_id)
            .filter((id: string) => id);

        let actionsMap: Record<string, any> = {};
        if (actionIds.length > 0) {
            const { data: actionsData } = await supabase
                .from("coach_actions")
                .select("id, name")
                .in("id", actionIds);

            if (actionsData) {
                actionsMap = actionsData.reduce((acc, action) => {
                    acc[action.id] = action;
                    return acc;
                }, {} as Record<string, any>);
            }
        }

        // 8. 初始化 action_executions（使用真实动作名称）
        const actionExecutions = actionSets.map((
            actionSet: any,
            idx: number,
        ) => ({
            action_id: actionSet.action_id,
            action_name: actionsMap[actionSet.action_id]?.name ||
                actionSet.set_name || "未知动作",
            action_order: idx + 1,
            sets: Array.from({ length: actionSet.sets || 1 }, (_, i) => ({
                set_number: i + 1,
                status: "pending",
                planned_reps: actionSet.reps,
                planned_weight: actionSet.intensity,
                planned_rest_seconds: actionSet.rest_seconds || 90,
                has_video: false,
                is_pr: false,
            })),
            total_sets: actionSet.sets || 1,
            completed_sets: 0,
        }));

        const totalSets = actionExecutions.reduce(
            (sum, a) => sum + a.total_sets,
            0,
        );

        // 8. 创建新的执行记录
        const { data: newExecution, error: insertError } = await supabase
            .from("plan_instance_executions")
            .insert({
                instance_id: instanceId,
                student_id: userId,
                dayIndex: dayIndex,
                action_executions: actionExecutions,
                total_sets: totalSets,
                completed_sets: 0,
                status: "in_progress",
            })
            .select()
            .single();

        if (insertError) {
            console.error("创建执行记录失败:", insertError);
            return NextResponse.json<StartExecutionResponseDto>(
                { success: false, message: "创建训练记录失败" },
                { status: 500 },
            );
        }

        return NextResponse.json<StartExecutionResponseDto>({
            success: true,
            data: newExecution,
        });
    } catch (error) {
        console.error("开始训练失败:", error);
        return NextResponse.json<StartExecutionResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
