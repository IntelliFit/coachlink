import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import type {
    GetWithExecutionsDto,
    GetWithExecutionsResponseDto,
} from "./entity";
import {
    evaluateSubscriptionPlanAccess,
    filterTrainingDaysByAccessWindow,
} from "@/lib/subscriptionAccess";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import {
    persistCompletedPlanInstanceIfNeeded,
    summarizePlanCompletion,
} from "@/lib/planInstanceCompletion";

/**
 * GET /api/plan-lib/get-with-executions
 *
 * Fetches the user's current plan instance with all execution data
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>(
                { success: false, message: "未登录", data: null },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const isCoach = session.user.is_coach;
        const {
            subscriptionId,
            instanceId,
        } = await req.json() as GetWithExecutionsDto;

        let instance: any = null;
        let enforceStudentSubscriptionAccess = false;
        let subscriptionForStudentAccess: any = null;
        let maxAccessibleDayIndex: number | null = null;

        // 方式1: 直接通过 instanceId 获取（支持自建计划）
        if (instanceId) {
            const { data: directInstance } = await supabase
                .from("coach_plan_instances")
                .select("*")
                .eq("id", instanceId)
                .single();

            if (directInstance) {
                // 权限检查
                const isOwner = directInstance.student_id === userId;
                let isAuthorized = isOwner;
                if (isOwner) {
                    enforceStudentSubscriptionAccess = true;
                }

                if (!isAuthorized && directInstance.coach_subscription_id) {
                    const { data: ownedSubscription } = await supabase
                        .from("coach_subscriptions")
                        .select("id, student_id, status, start_date, end_date, subscribed_weeks")
                        .eq("id", directInstance.coach_subscription_id)
                        .eq("student_id", userId)
                        .maybeSingle();

                    if (ownedSubscription) {
                        isAuthorized = true;
                        enforceStudentSubscriptionAccess = true;
                        subscriptionForStudentAccess = ownedSubscription;
                    }
                }

                if (!isAuthorized && isCoach) {
                    // 如果是教练，检查是否有权查看
                    const { data: coachProfile } = await supabase
                        .from("coaches")
                        .select("id")
                        .eq("user_id", userId)
                        .single();

                    if (coachProfile) {
                        // 1. 检查是否是该计划的指派教练
                        if (directInstance.coach_id === coachProfile.id) {
                            isAuthorized = true;
                        } else {
                            // 2. 检查该学员是否是教练的订阅学员（即使是自建计划也允许查看）
                            const { data: sub } = await supabase
                                .from("coach_subscriptions")
                                .select("id")
                                .eq("coach_id", coachProfile.id)
                                .eq("student_id", directInstance.student_id)
                                .maybeSingle();

                            if (sub) {
                                isAuthorized = true;
                                enforceStudentSubscriptionAccess = false;
                            }
                        }
                    }
                }

                if (isAuthorized) {
                    instance = directInstance;
                }
            }
        }

        // 方式2: 通过 subscriptionId 获取
        if (!instance && subscriptionId) {
            // 1. Get subscription - 支持教练和学员两种角色，用户可能同时拥有两种身份
            let activeSub: any = null;
            // 指定了 subscriptionId，先检查作为学员的订阅
            const { data: studentSub } = await supabase
                .from("coach_subscriptions")
                .select("id, coach_id, status, start_date, end_date, subscribed_weeks")
                .eq("id", subscriptionId)
                .eq("student_id", userId)
                .single();

            if (studentSub) {
                activeSub = studentSub;
                enforceStudentSubscriptionAccess = true;
                subscriptionForStudentAccess = studentSub;
            } else if (isCoach) {
                // 如果不是学员的订阅，且用户是教练，检查是否是教练的订阅
                const { data: coach } = await supabase
                    .from("coaches")
                    .select("id")
                    .eq("user_id", userId)
                    .single();

                if (coach) {
                    const { data: coachSub } = await supabase
                        .from("coach_subscriptions")
                        .select("id, coach_id, status")
                        .eq("id", subscriptionId)
                        .eq("coach_id", coach.id)
                        .single();
                    activeSub = coachSub;
                    enforceStudentSubscriptionAccess = false;
                }
            }

            if (activeSub) {
                // 2. Get plan instance for this subscription
                const { data: subInstance } = await supabase
                    .from("coach_plan_instances")
                    .select("*")
                    .eq("coach_subscription_id", activeSub.id)
                    // 仅取当前计划，避免把历史 completed/archived 的执行记录带到“当前计划编辑页”里
                    .in("status", ["active", "paused"])
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                instance = subInstance;
            }
        }

        // 方式3: 没有指定任何参数，查找学员的活跃订阅
        if (!instance && !subscriptionId && !instanceId) {
            const { data: subs } = await supabase
                .from("coach_subscriptions")
                .select("id, coach_id, status, start_date, end_date, subscribed_weeks")
                .eq("student_id", userId)
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(1);

            const activeSub = subs?.[0];
            if (activeSub) {
                enforceStudentSubscriptionAccess = true;
                subscriptionForStudentAccess = activeSub;
                const { data: defaultInstance } = await supabase
                    .from("coach_plan_instances")
                    .select("*")
                    .eq("coach_subscription_id", activeSub.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                instance = defaultInstance;
            }
        }

        if (!instance) {
            return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>(
                { success: false, message: "未找到训练计划", data: null },
                { status: 404 },
            );
        }

        const isHistoricalInstanceView = !!instanceId &&
            ["completed", "archived"].includes(
                String(instance.status ?? "").trim().toLowerCase(),
            );
        // 显式按实例 ID 打开的历史详情属于只读查看，不应再被订阅门禁直接挡住。
        let shouldBypassSubscriptionGate = !!instanceId || isHistoricalInstanceView;
        if (
            !shouldBypassSubscriptionGate &&
            !!instanceId &&
            enforceStudentSubscriptionAccess &&
            String(instance.status ?? "").trim().toLowerCase() === "active"
        ) {
            const getDayIndex = (day: any) =>
                Number(day?.dayIndex ?? day?.day_index ?? 0);
            const startExecutionDay = Number(instance.start_execution_day || 1);
            const trainingDays = (Array.isArray(instance.training_days)
                ? instance.training_days
                : [])
                .filter((day: any) => {
                    const di = getDayIndex(day);
                    return di >= startExecutionDay && day?.type === "training";
                });
            const trainingDayIndexList = trainingDays
                .map((day: any) => getDayIndex(day))
                .filter((di: number) => di > 0);
            if (trainingDayIndexList.length > 0) {
                const { data: resolvedExecutions } = await supabase
                    .from("plan_instance_executions")
                    .select("day_index")
                    .eq("instance_id", instance.id)
                    .in("status", ["completed", "abandoned"]);
                const resolvedDaySet = new Set<number>(
                    (resolvedExecutions || [])
                        .map((exec: any) => Number(exec?.day_index ?? 0))
                        .filter((di: number) => di > 0),
                );
                const allTrainingDaysResolved = trainingDayIndexList.every(
                    (di: number) => resolvedDaySet.has(di),
                );
                if (allTrainingDaysResolved) {
                    shouldBypassSubscriptionGate = true;
                }
            }
        }

        if (
            enforceStudentSubscriptionAccess &&
            instance.coach_subscription_id &&
            !shouldBypassSubscriptionGate
        ) {
            if (
                !subscriptionForStudentAccess ||
                subscriptionForStudentAccess.id !== instance.coach_subscription_id
            ) {
                const { data: subForAccess } = await supabase
                    .from("coach_subscriptions")
                    .select("id, student_id, status, start_date, end_date, subscribed_weeks")
                    .eq("id", instance.coach_subscription_id)
                    .eq("student_id", userId)
                    .maybeSingle();
                subscriptionForStudentAccess = subForAccess;
            }
            if (!subscriptionForStudentAccess) {
                return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>(
                    { success: false, message: "权限不足", data: null },
                    { status: 403 },
                );
            }

            const { data: completedExecutionsForAccess } = await supabase
                .from("plan_instance_executions")
                .select("day_index, status")
                .eq("instance_id", instance.id)
                .eq("status", "completed");

            const decision = evaluateSubscriptionPlanAccess({
                subscription: subscriptionForStudentAccess,
                trainingDays: Array.isArray(instance.training_days)
                    ? (instance.training_days as any[])
                    : [],
                executions: (completedExecutionsForAccess || []).map((exec: any) => ({
                    day_index: Number(exec?.day_index ?? 0),
                    status: exec?.status || "completed",
                })),
                startExecutionDay: Number(instance.start_execution_day || 1),
                effectiveSubscribedWeeks: (
                    await getSubscriptionCarryoverSummary({
                        subscriptionId: String(instance.coach_subscription_id || ""),
                        subscribedWeeks: Number(
                            subscriptionForStudentAccess?.subscribed_weeks || 0,
                        ),
                        excludeInstanceId: String(instance.id || ""),
                        createdBefore: (instance as any)?.created_at || null,
                        subscriptionStartDate:
                            (subscriptionForStudentAccess as any)?.start_date || null,
                    })
                ).remainingWeeks,
            });
            if (!decision.allowed) {
                return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>(
                    {
                        success: false,
                        message: decision.reason === "SUBSCRIPTION_EXPIRED"
                            ? "订阅已过期，请续费后继续训练"
                            : "当前训练内容不在订阅范围内",
                        data: null,
                    },
                    { status: 403 },
                );
            }

            maxAccessibleDayIndex = decision.maxAccessibleDayIndex;
        }

        // 3. Get all executions for this instance
        let executionsQuery = supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("instance_id", instance.id);
        if (maxAccessibleDayIndex !== null) {
            executionsQuery = executionsQuery.lte(
                "day_index",
                maxAccessibleDayIndex,
            );
        }
        const { data: executions } = await executionsQuery.order("started_at", {
            ascending: false,
        });

        // Build executions map by dayIndex (most recent execution for each day)
        const executionsMap: Record<number, any> = {};
        if (executions) {
            for (const exec of executions) {
                // Keep only most recent execution per day
                if (!executionsMap[exec.day_index]) {
                    executionsMap[exec.day_index] = exec;
                }
            }
        }

        // 4. Get videos for all executions
        const executionIds = executions?.map((e) => e.id) || [];
        let videosMap: Record<string, any[]> = {};

        if (executionIds.length > 0) {
            const { data: videos } = await supabase
                .from("execution_set_videos")
                .select("*")
                .in("execution_id", executionIds);

            if (videos) {
                for (const video of videos) {
                    const key =
                        `${video.execution_id}:${video.action_id}:${video.set_number}`;
                    if (!videosMap[key]) {
                        videosMap[key] = [];
                    }
                    videosMap[key].push(video);
                }
            }
        }

        // 5. Enrich execution action_executions with video_url from videos table
        for (const dayIndex of Object.keys(executionsMap)) {
            const exec = executionsMap[parseInt(dayIndex)];
            if (
                exec.action_executions && Array.isArray(exec.action_executions)
            ) {
                for (const actionExec of exec.action_executions) {
                    if (actionExec.sets && Array.isArray(actionExec.sets)) {
                        for (const set of actionExec.sets) {
                            const key =
                                `${exec.id}:${actionExec.action_id}:${set.set_number}`;
                            const videoRecords = videosMap[key];
                            if (videoRecords && videoRecords.length > 0) {
                                set.video_url = videoRecords[0].video_url;
                                set.has_video = true;
                            }
                        }
                    }
                }
            }
        }

        // 6. Get action details from coach_actions
        // 收集来自两个来源的 action IDs:
        // 1. 当前计划的 training_days
        // 2. 执行记录中的 action_executions (用于显示旧执行记录的动作名)
        const trainingDays = filterTrainingDaysByAccessWindow(
            (instance.training_days as any[]) || [],
            maxAccessibleDayIndex,
        );
        const completionSummary = summarizePlanCompletion({
            trainingDays: Array.isArray(instance.training_days)
                ? (instance.training_days as any[])
                : [],
            startExecutionDay: Number(instance.start_execution_day || 1),
            executions: (executions || []).map((exec: any) => ({
                day_index: Number(exec?.day_index ?? 0),
                status: exec?.status || null,
                completed_at: exec?.completed_at || null,
                updated_at: exec?.updated_at || null,
            })),
        });
        instance = await persistCompletedPlanInstanceIfNeeded({
            supabase,
            instance,
            summary: completionSummary,
        });
        instance.training_days = trainingDays;
        const actionIds = new Set<string>();

        // 从 training_days 收集
        for (const day of trainingDays) {
            if (day.actionSets && Array.isArray(day.actionSets)) {
                for (const actionSet of day.actionSets) {
                    // 支持两种字段名: action_id 和 actionId
                    const actionId = actionSet.action_id || actionSet.actionId;
                    if (actionId) {
                        actionIds.add(actionId);
                    }
                }
            }
        }

        // 从执行记录收集 (用于显示可能来自旧计划的执行记录)
        for (const dayIndex of Object.keys(executionsMap)) {
            const exec = executionsMap[parseInt(dayIndex)];
            if (
                exec.action_executions && Array.isArray(exec.action_executions)
            ) {
                for (const actionExec of exec.action_executions) {
                    if (actionExec.action_id) {
                        actionIds.add(actionExec.action_id);
                    }
                }
            }
        }

        let actionsMap: Record<string, any> = {};
        if (actionIds.size > 0) {
            const { data: actions } = await supabase
                .from("coach_actions")
                .select("id, name, detail, url")
                .in("id", Array.from(actionIds));

            if (actions) {
                for (const action of actions) {
                    actionsMap[action.id] = action;
                }
            }
        }

        // 7. 为 executionsMap 补齐 action_name（便于前端展示执行记录）
        for (const dayIndex of Object.keys(executionsMap)) {
            const exec = executionsMap[parseInt(dayIndex)];
            if (!exec?.action_executions || !Array.isArray(exec.action_executions)) continue;
            for (const actionExec of exec.action_executions) {
                if (!actionExec) continue;
                if (!actionExec.action_name && actionExec.action_id) {
                    actionExec.action_name =
                        actionsMap[actionExec.action_id]?.name ||
                        actionExec.exercise_name ||
                        actionExec.action_id;
                }
            }
        }

        return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>({
            success: true,
            message: "获取训练计划执行数据成功",
            data: {
                instance,
                training_days: trainingDays,
                executions: executionsMap,
                actions: actionsMap,
            },
        });
    } catch (error) {
        console.error("获取训练计划执行数据失败:", error);
        return NextResponse.json<ApiData<GetWithExecutionsResponseDto>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}
