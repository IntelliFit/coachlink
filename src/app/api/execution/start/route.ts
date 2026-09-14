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
import { toBeijingDateKey } from "@/lib/beijingTime";
import { expireAndActivatePendingPlanRevisions } from "@/lib/planExecutionLifecycle";

function canManuallyAdvanceAcrossRestDays(params: {
    planDays: any[];
    recommendedDayIndex: number;
    requestedDayIndex: number;
}) {
    const { planDays, recommendedDayIndex, requestedDayIndex } = params;
    if (requestedDayIndex <= recommendedDayIndex) return false;

    const remainingDays = [...(planDays || [])]
        .filter((day) => Number(day?.dayIndex || 0) >= recommendedDayIndex)
        .sort((left, right) => Number(left?.dayIndex || 0) - Number(right?.dayIndex || 0));
    const firstTrainingDay = remainingDays.find(
        (day) => String(day?.type || "training").toLowerCase() === "training",
    );
    if (Number(firstTrainingDay?.dayIndex || 0) !== requestedDayIndex) return false;

    return remainingDays
        .filter((day) => {
            const index = Number(day?.dayIndex || 0);
            return index >= recommendedDayIndex && index < requestedDayIndex;
        })
        .every((day) => String(day?.type || "training").toLowerCase() !== "training");
}

function getSetPrescriptions(actionSet: any): any[] {
    const params = actionSet?.params || {};
    const value = params?.setPrescriptions ?? params?.set_prescriptions;
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function formatPrescriptionIntensity(prescription: any, fallback: unknown): string {
    const explicit = String(prescription?.intensity ?? "").trim();
    if (explicit) return explicit;
    return String(fallback ?? "").trim();
}

function intensityConfigFromPrescription(prescription: any) {
    if (prescription?.intensityConfig) {
        return normalizeIntensityConfig({ intensityConfig: prescription.intensityConfig });
    }

    const unit = String(prescription?.intensityUnit ?? prescription?.intensity_unit ?? "")
        .trim()
        .toLowerCase();
    const rawValue = prescription?.intensityValue ?? prescription?.intensity_value;
    const firstValue = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const value = Number(firstValue);
    if (!Number.isFinite(value) || value <= 0) return undefined;

    if (unit === "%" || unit === "percent" || unit === "percentage") {
        return {
            relativeIntensity: {
                type: "percentage" as const,
                value,
            },
        };
    }
    if (unit === "rm") {
        return {
            relativeIntensity: {
                type: "rm" as const,
                value,
            },
        };
    }
    return undefined;
}

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

        const lifecycle = await expireAndActivatePendingPlanRevisions({ instanceId });
        if (lifecycle.activations.some((activation) => activation.activated)) {
            return NextResponse.json({
                success: false,
                code: "PLAN_REVISION_ACTIVATED",
                message: "教练更新的计划已生效，请刷新后重新开始训练",
            }, { status: 409 });
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
            explicitStartDate:
                (instance as any)?.start_date || (instance as any)?.created_at ||
                subscriptionStartDate || null,
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

        const actionSets = Array.isArray(trainingDay.actionSets)
            ? trainingDay.actionSets
            : Array.isArray(trainingDay.action_sets)
                ? trainingDay.action_sets
                : [];
        const isEmptyRestDay =
            String(trainingDay?.type || "training").toLowerCase() !== "training" &&
            actionSets.length === 0;
        if (isEmptyRestDay) {
            return NextResponse.json({
                success: false,
                code: "REST_DAY_HAS_NO_TASKS",
                message: "今天是休息日，无需开始训练",
            }, { status: 400 });
        }

        const isManualAdvanceAcrossRestDays = canManuallyAdvanceAcrossRestDays({
            planDays: trainingDays,
            recommendedDayIndex: Number(recommendedDayIndex),
            requestedDayIndex: Number(dayIndex),
        });

        if (Number(dayIndex) !== Number(recommendedDayIndex) && !isManualAdvanceAcrossRestDays) {
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
                    .select('id, name, type, canonical_action_id, "includesBodyWeight"')
                    .in("id", remainingIds);

                for (const action of studentActionsData || []) {
                    actionsMap[action.id] = {
                        ...action,
                        canonical_action_id: action.canonical_action_id,
                        includesBodyWeight: action.includesBodyWeight,
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
            const params = actionSet.params || {};
            const rawSetCount = Number(params?.["组数"] ?? actionSet.sets ?? 1);
            const setPrescriptions = getSetPrescriptions(actionSet);
            const itemType = String(
                actionSet.itemType || actionsMap[actionId]?.type || "STRENGTH",
            ).toUpperCase();
            const isStrength = itemType === "STRENGTH";
            const sourceSetCount = setPrescriptions.length > 0
                ? setPrescriptions.length
                : Number.isFinite(rawSetCount) && rawSetCount > 0
                    ? Math.max(1, Math.floor(rawSetCount))
                    : 1;
            // CARDIO/DIET/HABIT are completed as one item by complete-item.
            // Keeping multiple strength-style sets here would make progress
            // impossible to finish because that endpoint marks one item.
            const setCount = isStrength ? sourceSetCount : 1;
            const defaultReps = params?.["次数"] ?? actionSet.reps;
            const defaultIntensity = params?.["强度"] ?? actionSet.intensity;
            const prescriptionReps = setPrescriptions
                .map((item) => String(item?.reps || "").trim())
                .filter(Boolean);
            const uniquePrescriptionReps = Array.from(new Set(prescriptionReps));
            const nonStrengthReps = uniquePrescriptionReps.length === 1 && sourceSetCount > 1
                ? `${sourceSetCount} × ${uniquePrescriptionReps[0]}`
                : uniquePrescriptionReps.length > 0
                    ? uniquePrescriptionReps.join(" / ")
                    : defaultReps;
            const actionNameForLookup = actionsMap[actionId]?.name ||
                actionSet.actionName || actionSet.set_name;
            const canonicalActionId = actionsMap[actionId]?.canonical_action_id;
            const oneRM = oneRMMap[canonicalActionId] ?? oneRMMap[actionNameForLookup] ??
                oneRMMap[actionId] ?? undefined;
            const includesBodyWeight = !!(actionsMap[actionId]?.includesBodyWeight);

            const executionSets = Array.from({ length: setCount }, (_, setIndex) => {
                const prescription = setPrescriptions[setIndex] || null;
                const reps = isStrength ? (prescription?.reps ?? defaultReps) : nonStrengthReps;
                const rawIntensity = formatPrescriptionIntensity(prescription, defaultIntensity);
                const intensityConfig = prescription
                    ? intensityConfigFromPrescription(prescription)
                    : normalizeIntensityConfig(params);
                const legacyRm = prescription ? null : (params["强度"] ?? defaultIntensity);
                let load = prescription?.load ?? params?.load;
                let plannedIntensity = rawIntensity || null;
                const shouldRefreshExistingLoad = hasDynamicIntensityTarget({
                    intensityConfig,
                    legacyRm,
                });

                // RM/% targets are recomputed per set. RPE and other text stay
                // descriptive and are never coerced into a fake kg/RM value.
                if (shouldRefreshExistingLoad || load === null || load === undefined) {
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
                    if (result.displayText) plannedIntensity = result.displayText;
                }

                const restSeconds = normalizePlannedRestSeconds(
                    prescription?.restSeconds ?? prescription?.rest_seconds ??
                        params?.["休息时间"] ?? actionSet.rest_seconds,
                    90,
                );

                return {
                    set_number: setIndex + 1,
                    status: "pending",
                    planned_reps: reps !== null && reps !== undefined && String(reps).trim()
                        ? String(reps)
                        : null,
                    planned_weight: load !== null && load !== undefined && Number.isFinite(Number(load))
                        ? formatKgForGym(Number(load))
                        : null,
                    planned_intensity: plannedIntensity,
                    planned_target_type: prescription?.targetType ?? prescription?.target_type ?? null,
                    planned_target_unit: prescription?.targetUnit ?? prescription?.target_unit ?? null,
                    planned_rest_seconds: restSeconds,
                    has_video: false,
                    is_pr: false,
                };
            });

            return {
                action_id: actionId,
                action_name: actionsMap[actionId]?.name ||
                    actionSet.actionName || actionSet.set_name || "未知动作",
                action_order: idx + 1,
                item_type: itemType,
                planned_rounds: isStrength ? undefined : sourceSetCount,
                source_action_index: idx,
                sets: executionSets,
                total_sets: executionSets.length,
                completed_sets: 0,
            };
        });

        const totalSets = actionExecutions.reduce(
            (sum, a) => sum + a.total_sets,
            0,
        );

        // 8. 创建新的执行记录
        const { data: createdRows, error: insertError } = await (serviceRoleSupabase as any)
            .rpc("create_plan_execution_atomic", {
                p_instance_id: instanceId,
                p_student_id: userId,
                p_day_index: dayIndex,
                p_action_executions: actionExecutions,
                p_total_sets: totalSets,
            });
        const newExecution = Array.isArray(createdRows) ? createdRows[0] : createdRows;

        if (insertError) {
            if (String((insertError as any)?.message || "").includes("PLAN_INSTANCE_NOT_CURRENT")) {
                return NextResponse.json({
                    success: false,
                    code: "PLAN_REVISION_ACTIVATED",
                    message: "教练更新的计划已生效，请刷新后重新开始训练",
                }, { status: 409 });
            }
            console.error("创建执行记录失败:", insertError);
            return NextResponse.json<ApiData<StartExecutionResponseDto>>({
                success: false,
                message: "创建训练记录失败",
                data: null,
            }, { status: 500 });
        }
        if (!newExecution) {
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
                        const firstStartedAt =
                            (newExecution as any)?.started_at || new Date().toISOString();
                        await serviceRoleSupabase
                            .from("coach_subscriptions")
                            .update({
                                start_date: firstStartedAt,
                                updated_at: firstStartedAt,
                            } as any)
                            .eq("id", subscriptionId);

                        // D1 必须以第一次实际训练日期为准，覆盖分配计划时
                        // 预填的日期；后续 revision 再继承这个真实键点。
                        if (Number(dayIndex) === 1) {
                            await serviceRoleSupabase
                                .from("coach_plan_instances" as any)
                                .update({
                                    start_date: toBeijingDateKey(firstStartedAt),
                                    updated_at: firstStartedAt,
                                } as any)
                                .eq("id", instanceId);
                        }
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
