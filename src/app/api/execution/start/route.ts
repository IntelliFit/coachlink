import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { StartExecutionDto, StartExecutionResponseDto } from "./entity";
import { formatKgForGym } from "@/lib/weightQuantize";
import {
    calcIntensityDisplay,
    hasDynamicIntensityTarget,
    normalizeIntensityConfig,
} from "@/lib/rmCaculator";
import { normalizeToKg } from "@/types/intensity";
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";
import { getAuthUser } from "@/lib/auth";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";
import { normalizePlannedRestSeconds } from "@/lib/restTime";
import {
    deriveEffectiveStartExecutionDay,
    deriveStrictSequentialProgressDay,
} from "@/lib/planProgress";

/**
 * POST /api/execution/start
 *
 * 开始或恢复训练执行
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const authResult = await getAuthUser(request);
        if (!authResult.isAuthenticated || !authResult.userId) {
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = authResult.userId;

        // 2. 解析请求参数
        const body: StartExecutionDto = await request.json();
        const { instanceId, dayIndex } = body;

        if (!instanceId || !dayIndex) {
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: "缺少必填参数",
                data: null,
            }, { status: 400 });
        }

        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId,
            studentId: userId,
            dayIndex,
        });
        if (!accessDecision.allowed) {
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        // 3. Read an existing snapshot, but do not return it before validating
        // that an in-progress execution still belongs to the strict current
        // sequence day. Completed snapshots remain reviewable.
        const { data: existingExecution, error: existingExecutionError } = await serviceRoleSupabase
            .from("plan_instance_executions")
            .select("*")
            .eq("instance_id", instanceId)
            .eq("day_index", dayIndex)
            .eq("student_id", userId)
            // .gte("started_at", new Date().toISOString().split("T")[0]) // 移除此限制，以便可以查看过去的记录
            .neq("status", "abandoned")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (existingExecutionError) {
            console.error("Error checking existing execution:", existingExecutionError);
            return NextResponse.json({
                success: false,
                message: "检查训练记录失败",
            }, { status: 500 });
        }

        // 4. 获取计划实例和训练日
        const { data: instance, error: instanceError } = await supabase
            .from("coach_plan_instances")
            .select("*, training_days")
            .eq("id", instanceId)
            .single();

        if (instanceError || !instance) {
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: "计划实例不存在",
                data: null,
            }, { status: 404 });
        }

        // 5. 验证权限 - 检查学生是否有权访问此计划
        // 方式1: 通过订阅ID验证
        let subscriptionStartDate: string | null = null;
        if (instance.coach_subscription_id) {
            const { data: subscription, error: subError } = await supabase
                .from("coach_subscriptions")
                .select("student_id, start_date")
                .eq("id", instance.coach_subscription_id)
                .single();

            console.log("Subscription check:", {
                subscription_id: instance.coach_subscription_id,
                subscription,
                subError,
                userId,
            });

            if (subscription && subscription.student_id === userId) {
                subscriptionStartDate = subscription.start_date || null;
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
                    return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                        success: false,
                        message: "无权访问此计划",
                        data: null,
                    }, { status: 403 });
                }
            }
        }

        // 6. 找到对应的训练日
        const trainingDays = instance.training_days as any[];
        const trainingDay = trainingDays.find((d) => Number(d?.dayIndex) === Number(dayIndex));

        if (!trainingDay) {
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: "训练日不存在",
                data: null,
            }, { status: 404 });
        }

        const { data: sequenceExecutions, error: sequenceExecutionsError } = await serviceRoleSupabase
            .from("plan_instance_executions")
            .select("id, day_index, status, started_at, completed_at, updated_at, action_executions")
            .eq("instance_id", instanceId)
            .eq("student_id", userId)
            .order("started_at", { ascending: true });
        if (sequenceExecutionsError) {
            console.error("Error checking execution sequence:", sequenceExecutionsError);
            return NextResponse.json({
                success: false,
                message: "检查训练进度失败",
            }, { status: 500 });
        }

        const executionsByDayIndex: Record<number, any> = {};
        for (const execution of sequenceExecutions || []) {
            const executionDayIndex = Number((execution as any)?.day_index || 0);
            if (executionDayIndex > 0) {
                executionsByDayIndex[executionDayIndex] = execution;
            }
        }
        const effectiveStartExecutionDay = deriveEffectiveStartExecutionDay({
            storedStartExecutionDay: Number((instance as any)?.start_execution_day || 1),
            planDays: trainingDays,
            executionsByDayIndex,
            planStartDate: (instance as any)?.start_date || null,
            subscriptionStartDate,
        });
        const { recommendedDayIndex } = deriveStrictSequentialProgressDay({
            planDays: trainingDays,
            startExecutionDay: effectiveStartExecutionDay,
            executionsByDayIndex,
            explicitStartDate: (instance as any)?.start_date || null,
        });

        const existingStatus = String(existingExecution?.status || "").toLowerCase();
        if (existingExecution && existingStatus === "completed") {
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: true,
                message: "获取执行记录成功",
                // Execution rows are immutable plan snapshots. A later plan edit must
                // never reinterpret completed sets as another action at the same index.
                data: existingExecution,
            });
        }

        if (Number(dayIndex) !== Number(recommendedDayIndex)) {
            return NextResponse.json({
                success: false,
                code: "TRAINING_DAY_NOT_CURRENT",
                message: `请先完成当前第${recommendedDayIndex}天，再开始第${dayIndex}天`,
                data: { recommendedDayIndex },
            }, { status: 409 });
        }

        if (existingExecution && existingStatus === "in_progress") {
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: true,
                message: "获取执行记录成功",
                data: existingExecution,
            });
        }

        // 7. 获取动作库信息（用于获取真实动作名称）
        const actionSets = trainingDay.actionSets || [];
        // 支持两种字段名: action_id 和 actionId
        const actionIds = actionSets
            .map((a: any) => a.action_id || a.actionId)
            .filter((id: string) => id);
        let actionsMap: Record<string, any> = {};
        let bodyWeight = 0;
        const oneRMMap: Record<string, number> = {};

        // Preload student body weight + 1RM map (best-effort) so we can compute kg even when plan stores only RM/%.
        try {
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("weight")
                .eq("user_id", userId)
                .maybeSingle();
            bodyWeight = Number(profile?.weight || 0);
        } catch (e) {
            bodyWeight = 0;
        }

        if (actionIds.length > 0) {
            const { data: coachActionsData } = await supabase
                .from("coach_actions")
                .select('id, name, type, canonical_action_id, "includesBodyWeight"')
                .in("id", actionIds);

            if (coachActionsData) {
                actionsMap = coachActionsData.reduce((acc, action) => {
                    acc[action.id] = action;
                    return acc;
                }, {} as Record<string, any>);
            }

            const remainingIds = actionIds.filter((id) => !actionsMap[id]);
            if (remainingIds.length > 0) {
                const { data: studentActionsData } = await supabase
                    .from("student_actions")
                    .select("id, name, type, canonical_action_id, includes_body_weight")
                    .in("id", remainingIds);

                for (const action of studentActionsData || []) {
                    actionsMap[action.id] = {
                        ...action,
                        canonical_action_id: action.canonical_action_id,
                        includesBodyWeight: action.includes_body_weight,
                    };
                }
            }
        }

        const actionNames = Array.from(new Set(
            actionSets
                .map((a: any) => {
                    const actionId = a?.action_id || a?.actionId;
                    return String(
                        (actionId ? actionsMap[actionId]?.name : "") ||
                        a?.actionName ||
                        a?.set_name ||
                        "",
                    ).trim();
                })
                .filter((name: string) => !!name),
        ));

        try {
            const records = await getCurrent1RMRecords(userId, {
                actionIds,
                actionNames: actionNames.length > 0 ? actionNames : undefined,
                // 与计划页保持一致：按 PR 递增逻辑读取，避免状态波动导致自动降重。
                preferPR: true,
            });
            for (const r of records || []) {
                if (r.actionId) oneRMMap[r.actionId] = Math.max(oneRMMap[r.actionId] || 0, r.current1RM);
                if (r.actionName) oneRMMap[r.actionName] = Math.max(oneRMMap[r.actionName] || 0, r.current1RM);
                if (r.canonicalActionId) oneRMMap[r.canonicalActionId] = Math.max(oneRMMap[r.canonicalActionId] || 0, r.current1RM);
            }
        } catch (e) {
            // ignore
        }

        // 8. 初始化 action_executions（使用真实动作名称）
        const actionExecutions = actionSets.map((
            actionSet: any,
            idx: number,
        ) => {
            // 支持两种字段名
            const actionId = actionSet.action_id || actionSet.actionId;
            // 从 params 对象读取组数/次数等，兼容旧格式
            const sets = actionSet.params?.["组数"] || actionSet.sets || 1;
            const reps = actionSet.params?.["次数"] || actionSet.reps;
            const intensity = actionSet.params?.["强度"] || actionSet.intensity;

            let load = actionSet.params?.load;
            const params = actionSet.params || {};
            const intensityConfig = normalizeIntensityConfig(params);
            const legacyRm = params["强度"] ?? intensity;
            const shouldRefreshExistingLoad = hasDynamicIntensityTarget({
                intensityConfig,
                legacyRm,
            });
            // 与 today-training/get-instance 统一口径：
            // RM/% 动态强度优先按当前 1RM 重算；固定重量才沿用实例里已有 load。
            if (shouldRefreshExistingLoad || load === null || load === undefined) {
                const actionIdForLookup = actionId;
                const actionNameForLookup = actionsMap[actionIdForLookup]?.name || actionSet.actionName || actionSet.set_name;
                const canonicalActionId = actionsMap[actionIdForLookup]?.canonical_action_id;
                const oneRM = oneRMMap[canonicalActionId] ?? oneRMMap[actionNameForLookup] ?? oneRMMap[actionIdForLookup] ?? undefined;
                const includesBodyWeight = !!(actionsMap[actionIdForLookup]?.includesBodyWeight);

                const result = calcIntensityDisplay({
                    intensityConfig,
                    legacyRm,
                    oneRM,
                    bodyWeight,
                    includesBodyWeight,
                });

                if (result.displayWeight !== null && result.displayWeight !== undefined) {
                    load = normalizeToKg(Number(result.displayWeight), result.displayUnit || "kg");
                }
            }
            const restSeconds = normalizePlannedRestSeconds(
                actionSet.params?.["休息时间"] ?? actionSet.rest_seconds,
                90,
            );

            // 优先使用自动计算的重量(load)，否则显示RM值
            const plannedWeight =
                load !== null && load !== undefined
                    ? formatKgForGym(Number(load))
                : (intensity ? `${intensity}RM` : null);

            return {
                action_id: actionId,
                action_name: actionsMap[actionId]?.name ||
                    actionSet.actionName || actionSet.set_name || "未知动作",
                action_order: idx + 1,
                item_type: String(actionSet.itemType || actionsMap[actionId]?.type || "STRENGTH").toUpperCase(),
                source_action_index: idx,
                sets: Array.from({ length: sets }, (_, i) => ({
                    set_number: i + 1,
                    status: "pending",
                    planned_reps: reps ? `${reps}` : null,
                    planned_weight: plannedWeight,
                    planned_rest_seconds: restSeconds,
                    has_video: false,
                    is_pr: false,
                })),
                total_sets: sets,
                completed_sets: 0,
            };
        });

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
                day_index: dayIndex,
                action_executions: actionExecutions,
                total_sets: totalSets,
                completed_sets: 0,
                status: "in_progress",
            })
            .select()
            .single();

        if (insertError) {
            console.error("创建执行记录失败:", insertError);
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: "创建训练记录失败",
                data: null,
            }, { status: 500 });
        }

        // B1: Subscription starts when the student actually begins training (first execution).
        // We set start_date on first start. Expiry is driven by credits consumption, not calendar days.
        try {
            const subscriptionId = (instance as any).coach_subscription_id as string | null;
            if (subscriptionId) {
                const { data: subRow } = await serviceRoleSupabase
                    .from("coach_subscriptions")
                    .select("id, status, start_date, subscribed_weeks")
                    .eq("id", subscriptionId)
                    .maybeSingle();

                if (subRow && subRow.status === "active" && !subRow.start_date) {
                        const nowIso = new Date().toISOString();
                        await serviceRoleSupabase
                            .from("coach_subscriptions")
                            .update({
                                start_date: nowIso,
                                updated_at: nowIso,
                            } as any)
                            .eq("id", subscriptionId);

                        // Also set plan instance start_date (used by week unlock + date mapping in UI).
                        // This prevents dayIndex/calendar mismatches across "今日训练" vs "当前计划" pages.
                        await serviceRoleSupabase
                            .from("coach_plan_instances" as any)
                            .update({
                                start_date: nowIso,
                                updated_at: nowIso,
                            } as any)
                            .eq("id", instanceId)
                            .is("start_date", null);
                }
            }
        } catch (e) {
            console.error("[execution/start] Failed to start subscription window:", e);
        }

        return NextResponse.json<ApiData<StartExecutionResponseDto>>({
            success: true,
            message: "开始训练成功",
            data: newExecution,
        });
    } catch (error) {
        console.error("开始训练失败:", error);
        return NextResponse.json<ApiData<StartExecutionResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
