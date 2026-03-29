import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
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
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";

/**
 * POST /api/execution/start
 *
 * 开始或恢复训练执行
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;

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

        // 3. 检查今天是否已有执行记录
        const { data: existingExecution } = await supabase
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

        if (existingExecution) {
            // 如果是已完成状态，直接返回，不需要同步
            if (existingExecution.status === "completed") {
                return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                    success: true,
                    message: "获取执行记录成功",
                    data: existingExecution,
                });
            }

            // 对于 in_progress 状态，需要与母版计划同步
            // 获取最新的母版计划数据
            const { data: masterInstance } = await supabase
                .from("coach_plan_instances")
                .select("training_days")
                .eq("id", instanceId)
                .single();

            if (masterInstance) {
                const masterDays = masterInstance.training_days as any[];
                const masterDay = masterDays?.find((d: any) =>
                    d.dayIndex === dayIndex
                );

                if (masterDay) {
                    const masterActionSets = masterDay.actionSets || [];
                    const masterActionIds = masterActionSets
                        .map((set: any) => set?.action_id || set?.actionId)
                        .filter((id: any) => !!id);
                    const masterActionNames = Array.from(new Set(
                        masterActionSets
                            .map((set: any) => String(set?.actionName || set?.set_name || "").trim())
                            .filter((name: string) => !!name),
                    ));
                    const syncActionsMap: Record<string, any> = {};
                    let syncBodyWeight = 0;
                    const syncOneRMMap: Record<string, number> = {};

                    if (masterActionIds.length > 0) {
                        const { data: syncActionsData } = await supabase
                            .from("coach_actions")
                            .select('id, name, canonical_action_id, "includesBodyWeight"')
                            .in("id", masterActionIds);
                        if (syncActionsData) {
                            for (const action of syncActionsData) {
                                syncActionsMap[action.id] = action;
                            }
                        }
                    }

                    try {
                        const { data: profile } = await supabase
                            .from("user_profiles")
                            .select("weight")
                            .eq("user_id", userId)
                            .maybeSingle();
                        syncBodyWeight = Number(profile?.weight || 0);
                    } catch {
                        syncBodyWeight = 0;
                    }

                    try {
                        const syncRecords = await getCurrent1RMRecords(userId, {
                            actionIds: masterActionIds.length > 0 ? masterActionIds : undefined,
                            actionNames: masterActionNames.length > 0 ? masterActionNames : undefined,
                            preferPR: true,
                        });
                        for (const r of syncRecords || []) {
                            if (r.actionId) syncOneRMMap[r.actionId] = r.current1RM;
                            if (r.actionName) syncOneRMMap[r.actionName] = r.current1RM;
                            if (r.canonicalActionId) syncOneRMMap[r.canonicalActionId] = r.current1RM;
                        }
                    } catch {
                        // best-effort
                    }

                    const existingActionExecutions = existingExecution
                        .action_executions as any[];
                    let needsUpdate = false;

                    // 遍历并同步每个动作的计划数据（只更新 pending 状态的组）
                    const updatedActionExecutions = existingActionExecutions
                        .map((actionExec: any, actionIdx: number) => {
                            const masterActionSet = masterActionSets[actionIdx];
                            if (!masterActionSet) return actionExec;

                            const masterActionId = masterActionSet.action_id || masterActionSet.actionId;
                            const masterParams = masterActionSet.params || {};
                            const intensityConfig = normalizeIntensityConfig(masterParams);
                            const legacyRm = masterParams?.["强度"] ?? masterActionSet.intensity;
                            const shouldRefreshExistingLoad = hasDynamicIntensityTarget({
                                intensityConfig,
                                legacyRm,
                            });

                            let masterLoad = masterParams?.load;
                            if (
                                masterLoad === null ||
                                masterLoad === undefined ||
                                shouldRefreshExistingLoad
                            ) {
                                const actionNameForLookup =
                                    syncActionsMap[masterActionId]?.name ||
                                    masterActionSet.actionName ||
                                    masterActionSet.set_name;
                                const canonicalActionId = syncActionsMap[masterActionId]?.canonical_action_id;
                                const oneRM = syncOneRMMap[canonicalActionId] ??
                                    syncOneRMMap[actionNameForLookup] ??
                                    syncOneRMMap[masterActionId] ??
                                    undefined;
                                const includesBodyWeight = !!syncActionsMap[masterActionId]?.includesBodyWeight;

                                const loadResult = calcIntensityDisplay({
                                    intensityConfig,
                                    legacyRm,
                                    oneRM,
                                    bodyWeight: syncBodyWeight,
                                    includesBodyWeight,
                                });

                                if (loadResult.displayWeight !== null && loadResult.displayWeight !== undefined) {
                                    masterLoad = normalizeToKg(
                                        Number(loadResult.displayWeight),
                                        loadResult.displayUnit || "kg",
                                    );
                                }
                            }

                            const masterReps =
                                masterActionSet.params?.["次数"] ||
                                masterActionSet.reps;
                            const masterSets =
                                masterActionSet.params?.["组数"] ||
                                masterActionSet.sets || 1;

                            // 计算母版的计划重量
                            const masterPlannedWeight =
                                masterLoad !== null && masterLoad !== undefined
                                    ? formatKgForGym(Number(masterLoad))
                                    : (legacyRm ? `${legacyRm}RM` : null);
                            const masterPlannedReps = masterReps
                                ? `${masterReps}`
                                : null;

                            // 更新每个 pending 状态的组
                            const updatedSets = actionExec.sets.map(
                                (set: any) => {
                                    // 只更新 pending 状态的组，不影响已完成或已输入数据的组
                                    if (set.status !== "pending") {
                                        return set;
                                    }

                                    // 检查是否有变化
                                    if (
                                        set.planned_weight !==
                                            masterPlannedWeight ||
                                        set.planned_reps !== masterPlannedReps
                                    ) {
                                        needsUpdate = true;
                                        return {
                                            ...set,
                                            planned_weight: masterPlannedWeight,
                                            planned_reps: masterPlannedReps,
                                        };
                                    }
                                    return set;
                                },
                            );

                            return {
                                ...actionExec,
                                item_type: String(masterActionSet.itemType || actionExec?.item_type || "STRENGTH").toUpperCase(),
                                source_action_index: Number.isInteger(actionExec?.source_action_index)
                                    ? actionExec.source_action_index
                                    : actionIdx,
                                sets: updatedSets,
                                total_sets: masterSets, // 同步组数
                            };
                        });

                    // 如果有变化，更新数据库
                    if (needsUpdate) {
                        const { data: updatedExecution, error: updateError } =
                            await supabase
                                .from("plan_instance_executions")
                                .update({
                                    action_executions: updatedActionExecutions,
                                    updated_at: new Date().toISOString(),
                                })
                                .eq("id", existingExecution.id)
                                .select()
                                .single();

                        if (!updateError && updatedExecution) {
                            console.log("已同步执行记录与母版计划");
                            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                                success: true,
                                message: "同步执行记录成功",
                                data: updatedExecution,
                            });
                        }
                    }
                }
            }

            // 没有变化或同步失败，返回原执行记录
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: true,
                message: "获取执行记录成功",
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
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: "计划实例不存在",
                data: null,
            }, { status: 404 });
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
        const trainingDay = trainingDays.find((d) => d.dayIndex === dayIndex);

        if (!trainingDay) {
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: "训练日不存在",
                data: null,
            }, { status: 404 });
        }

        // 7. 获取动作库信息（用于获取真实动作名称）
        const actionSets = trainingDay.actionSets || [];
        // 支持两种字段名: action_id 和 actionId
        const actionIds = actionSets
            .map((a: any) => a.action_id || a.actionId)
            .filter((id: string) => id);
        const actionNames = Array.from(new Set(
            actionSets
                .map((a: any) => String(a?.actionName || a?.set_name || "").trim())
                .filter((name: string) => !!name),
        ));

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

        if (actionIds.length > 0) {
            const { data: actionsData } = await supabase
                .from("coach_actions")
                .select('id, name, type, canonical_action_id, "includesBodyWeight"')
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
        ) => {
            // 支持两种字段名
            const actionId = actionSet.action_id || actionSet.actionId;
            // 从 params 对象读取组数/次数等，兼容旧格式
            const sets = actionSet.params?.["组数"] || actionSet.sets || 1;
            const reps = actionSet.params?.["次数"] || actionSet.reps;
            const intensity = actionSet.params?.["强度"] || actionSet.intensity;

            // Compute a concrete load (kg) if not already present
            let load = actionSet.params?.load; // 自动计算的实际重量
            const params = actionSet.params || {};
            const intensityConfig = normalizeIntensityConfig(params);
            const legacyRm = params["强度"] ?? intensity;
            const shouldRefreshExistingLoad = hasDynamicIntensityTarget({
                intensityConfig,
                legacyRm,
            });
            if (
                load === null ||
                load === undefined ||
                shouldRefreshExistingLoad
            ) {
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
            const restSeconds = actionSet.params?.["休息时间"] ||
                actionSet.rest_seconds || 90;

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
