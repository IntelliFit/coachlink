import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { GetTodayTrainingInstanceDto, GetTodayTrainingInstanceResponseDto } from "./entity";
import type { GetInstanceResponseDto } from "../get-instance/entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { calcIntensityDisplay, normalizeIntensityConfig } from "@/lib/rmCaculator";
import { normalizeToKg } from "@/types/intensity";
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";
import { syncCoachActionsToStudentLibrary } from "../sync-actions";
import {
    evaluateSubscriptionPlanAccess,
    filterTrainingDaysByAccessWindow,
} from "@/lib/subscriptionAccess";

// 内部辅助函数：获取单个计划实例（复用 get-instance 的核心逻辑）
async function getSingleInstance(
    userId: string,
    session: any,
    options: {
        subscriptionIds?: string[];
        fetchSelf?: boolean;
    }
): Promise<GetInstanceResponseDto | null> {
    const startTime = performance.now();
    const timings: Record<string, number> = {};
    const { subscriptionIds, fetchSelf } = options;

    // 查询计划实例
    const t0 = performance.now();
    let query = supabase
        .from("coach_plan_instances")
        .select("*");

    if (subscriptionIds && subscriptionIds.length > 0) {
        // 批量查询：找到第一个有计划的订阅
        query = query
            .in("coach_subscription_id", subscriptionIds)
            // 只取当前有效实例，避免选到已归档/已完成的历史实例
            .in("status", ["active", "paused"])
            .order("created_at", { ascending: false })
            .limit(1);
    } else if (fetchSelf) {
        // 查询自建计划
        query = query
            .eq("student_id", userId)
            .eq("source", "self")
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(1);
    } else {
        return null;
    }

    const { data: instance, error } = await query.maybeSingle();
    timings['1_query_instance'] = performance.now() - t0;

    if (error || !instance) {
        return null;
    }

    // 检查权限（优化：大部分用户是学员，先检查学员权限）
    const t1 = performance.now();
    let hasPermission = false;
    let hasCoachPermission = false;
    let subscriptionStudentId: string | null = null;
    let subscriptionForStudentAccess: any = null;

    // 优先检查学员权限（更常见的情况）
    if (instance.student_id) {
        if (instance.student_id === userId) {
            hasPermission = true;
        }
    } else if (instance.coach_subscription_id) {
        // 如果通过订阅关联，查询订阅信息（同时获取 student_id 供后续使用）
        const { data: subscription } = await supabase
            .from("coach_subscriptions")
            .select("student_id, status, end_date, subscribed_weeks")
            .eq("id", instance.coach_subscription_id)
            .single();

        subscriptionStudentId = subscription?.student_id || null;
        if (subscription && subscription.student_id === userId) {
            hasPermission = true;
            subscriptionForStudentAccess = subscription;
        }
    }

    // 仅当用户是教练且尚未有权限时，才检查教练权限（少数情况）
    if (!hasPermission && session.user.is_coach && instance.coach_id) {
        const { data: coach } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", instance.coach_id)
            .single();

        if (coach && coach.user_id === userId) {
            hasPermission = true;
            hasCoachPermission = true;
        }
    }

    timings['2_check_permission'] = performance.now() - t1;

    if (!hasPermission) {
        return null;
    }

    let maxAccessibleDayIndex: number | null = null;
    if (!hasCoachPermission && instance.coach_subscription_id) {
        if (!subscriptionForStudentAccess) {
            const { data: subForAccess } = await supabase
                .from("coach_subscriptions")
                .select("id, student_id, status, end_date, subscribed_weeks")
                .eq("id", instance.coach_subscription_id)
                .eq("student_id", userId)
                .maybeSingle();
            subscriptionForStudentAccess = subForAccess;
        }
        if (!subscriptionForStudentAccess) {
            return null;
        }

        const decision = evaluateSubscriptionPlanAccess({
            subscription: subscriptionForStudentAccess,
        });
        if (!decision.allowed) {
            return null;
        }
        maxAccessibleDayIndex = decision.maxAccessibleDayIndex;
    }

    if (Array.isArray((instance as any).training_days)) {
        (instance as any).training_days = filterTrainingDaysByAccessWindow(
            (instance as any).training_days as any[],
            maxAccessibleDayIndex,
        );
    }
    if (
        maxAccessibleDayIndex !== null &&
        Number((instance as any).start_execution_day || 1) >
            maxAccessibleDayIndex
    ) {
        return null;
    }

    // 加载动作详情
    const t2 = performance.now();
    let actionsMap: Record<string, any> = {};
    if (instance.training_days) {
        const trainingDays = instance.training_days as any[];
        const actionIds = new Set<string>();

        trainingDays.forEach((day: any) => {
            day.actionSets?.forEach((set: any) => {
                const actionId = set.action_id || set.actionId;
                if (actionId) {
                    actionIds.add(actionId);
                }
            });
        });

        if (actionIds.size > 0) {
            const idsList = Array.from(actionIds);

            // 查询教练动作库
            const { data: coachActions } = await supabase
                .from("coach_actions")
                .select("*")
                .in("id", idsList);

            if (coachActions) {
                coachActions.forEach((action) => {
                    actionsMap[action.id] = action;
                });

                // 教练计划涉及的动作自动同步到学员动作库，便于后续按动作维护全局1RM。
                const syncTargetStudentId =
                    (instance.student_id as string | null) || subscriptionStudentId;
                if (syncTargetStudentId && instance.coach_subscription_id) {
                    await syncCoachActionsToStudentLibrary(
                        syncTargetStudentId,
                        coachActions as any[],
                        actionIds,
                    );
                }
            }

            // 查询学员动作库
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
    timings['3_load_actions'] = performance.now() - t2;

    // Auto load compute (计算训练负荷)
    const t3 = performance.now();
    try {
        // 使用权限检查时已获取的 subscriptionStudentId，避免重复查询
        const targetStudentId: string | null =
            (instance.student_id as string | null) || subscriptionStudentId;

        if (targetStudentId && Array.isArray(instance.training_days)) {
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("weight")
                .eq("user_id", targetStudentId)
                .maybeSingle();

            const bodyWeight = Number(profile?.weight || 0);

            // Build a 1RM map (ID + Name) for fast lookup
            const records = await getCurrent1RMRecords(userId, {
                targetUserId: targetStudentId,
                // 计划负荷统一按 PR 递增逻辑计算，避免状态波动导致自动降重。
                // 学员若需下调，必须通过手动编辑动作库 reference_1rm。
                preferPR: true,
            });

            const rmMap: Record<string, number> = {};
            // getCurrent1RMRecords 已经返回了每个动作的最新记录（按时间优先级）
            // 直接使用返回的值，不需要 Math.max
            for (const r of records || []) {
                if (r.actionId && r.current1RM > 0) {
                    rmMap[r.actionId] = r.current1RM;
                }
                if (r.actionName && r.current1RM > 0) {
                    rmMap[r.actionName] = r.current1RM;
                }
            }

            const days = instance.training_days as any[];
            for (const day of days) {
                if (!Array.isArray(day.actionSets)) continue;
                for (const set of day.actionSets) {
                    const actionId = set.action_id || set.actionId;
                    if (!actionId) continue;

                    const params = set.params || {};
                    const existingLoad = params.load;
                    // 当 load 已存在时，始终保留 DB 中的值，不再重新计算。
                    // 与 execution/start 行为一致，避免今日训练与执行页重量显示不一致。
                    if (existingLoad !== null && existingLoad !== undefined) {
                        continue;
                    }

                    const intensityConfig = normalizeIntensityConfig(params);
                    const legacyRm = params["强度"] ?? set.intensity;
                    const oneRM = rmMap[actionId] ?? rmMap[actionsMap[actionId]?.name] ?? rmMap[set.actionName] ?? undefined;

                    // resolve includesBodyWeight from action row if present
                    const includesBodyWeight =
                        !!(actionsMap[actionId]?.includesBodyWeight ?? actionsMap[actionId]?.includes_body_weight);

                    const result = calcIntensityDisplay({
                        intensityConfig,
                        legacyRm,
                        oneRM,
                        bodyWeight,
                        includesBodyWeight,
                    });

                    if (result.displayWeight !== null && result.displayWeight !== undefined) {
                        const kg = normalizeToKg(Number(result.displayWeight), result.displayUnit || "kg");
                        set.params = {
                            ...params,
                            load: kg,
                            loadUnit: "kg",
                            loadSource: result.source,
                            loadDisplayText: result.displayText,
                            loadCalculated: result.source === "calculated",
                        };
                    }
                }
            }

            // Re-assign so it shows up in response JSON
            (instance as any).training_days = days;
        }
    } catch (e) {
        // best-effort; never block plan rendering
        console.warn("[get-today-training-instance] auto load compute skipped:", e);
    } finally {
        timings['4_compute_load'] = performance.now() - t3;
    }

    // 加载执行记录（修复字段名：使用 instance_id 而不是 plan_instance_id）
    const t4 = performance.now();
    let executionsList: any[] = [];
    let executionsQuery = supabase
        .from("plan_instance_executions")
        .select(`
            *,
            action_executions (
                *,
                sets:execution_sets (
                    *,
                    video:execution_set_videos (*)
                )
            )
        `)
        .eq("instance_id", instance.id);

    if (maxAccessibleDayIndex !== null) {
        executionsQuery = executionsQuery.lte("day_index", maxAccessibleDayIndex);
    }

    const { data: executions } = await executionsQuery.order("day_index", {
        ascending: true,
    });

    if (executions) {
        executionsList = executions.map((exec: any) => ({
            ...exec,
            action_executions: exec.action_executions?.map((ae: any) => ({
                ...ae,
                sets: ae.sets?.map((s: any) => ({
                    ...s,
                    has_video: !!s.video?.length,
                    video_url: s.video?.[0]?.video_url,
                })),
            })),
        }));
    }
    timings['5_load_executions'] = performance.now() - t4;

    // 构建执行记录映射
    const t5 = performance.now();
    const executionsByDayIndex: Record<number, any> = {};
    for (const exec of executionsList || []) {
        const di = Number(exec?.day_index ?? 0);
        if (!di) continue;
        const prev = executionsByDayIndex[di];
        if (!prev) {
            executionsByDayIndex[di] = exec;
            continue;
        }
        const prevTime = prev?.started_at ? new Date(prev.started_at).getTime() : 0;
        const curTime = exec?.started_at ? new Date(exec.started_at).getTime() : 0;
        if (curTime >= prevTime) {
            executionsByDayIndex[di] = exec;
        }
    }
    timings['6_build_execution_map'] = performance.now() - t5;

    // 计算下一个训练日信息
    const t6 = performance.now();
    const startExecutionDay = Number((instance as any).start_execution_day || 1);
    const getDayIndex = (d: any) => Number(d?.dayIndex ?? d?.day_index ?? 0);
    const trainingDays = (Array.isArray(instance.training_days) ? (instance.training_days as any[]) : [])
        .slice()
        .sort((a, b) => getDayIndex(a) - getDayIndex(b));

    const trainingOnlyDays = trainingDays.filter((d) =>
        d?.type === "training" && getDayIndex(d) >= startExecutionDay
    );
    const trainingOnlyDayIndexSet = new Set(trainingOnlyDays.map((d) => getDayIndex(d)));

    const completedExecs = (executionsList || []).filter((e) =>
        e?.status === "completed" &&
        Number(e?.day_index ?? 0) >= startExecutionDay &&
        trainingOnlyDayIndexSet.has(Number(e?.day_index ?? 0))
    );

    const completionDates: Record<number, string> = {};
    const completedDaySet = new Set<number>();
    for (const e of completedExecs) {
        const di = Number(e.day_index);
        completedDaySet.add(di);
        if (e.completed_at) {
            const prev = completionDates[di];
            if (!prev || new Date(e.completed_at).getTime() >= new Date(prev).getTime()) {
                completionDates[di] = e.completed_at;
            }
        }
    }
    const completedDays = Array.from(completedDaySet.values()).sort((a, b) => a - b);

    // todayCompleted + todayExecutionId
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayExecution = completedExecs.find((e) => {
        if (!e?.completed_at) return false;
        const dt = new Date(e.completed_at);
        return dt >= today && dt < tomorrow;
    });
    const todayCompleted = !!todayExecution;
    const todayExecutionId = todayExecution?.id;

    // nextDayIndex
    let nextDayIndex = startExecutionDay;
    for (const day of trainingOnlyDays) {
        const di = getDayIndex(day);
        if (!completedDaySet.has(di)) {
            nextDayIndex = di;
            break;
        }
    }
    if (
        trainingOnlyDays.length > 0 &&
        trainingOnlyDays.every((d) => completedDaySet.has(getDayIndex(d)))
    ) {
        nextDayIndex = getDayIndex(trainingOnlyDays[0]);
    }
    if (trainingOnlyDays.length === 0) {
        nextDayIndex = startExecutionDay;
    }
    timings['7_calculate_next_day'] = performance.now() - t6;

    const matchedSubscriptionId: string | undefined =
        (subscriptionIds && subscriptionIds.length > 0)
            ? ((instance as any).coach_subscription_id as string | undefined)
            : undefined;

    const totalTime = performance.now() - startTime;
    timings['_total'] = totalTime;

    // 输出性能日志（仅在开发环境或超过阈值时）
    if (process.env.NODE_ENV === 'development' || totalTime > 1000) {
        console.log(`[get-today-training-instance] Performance timings (${totalTime.toFixed(2)}ms):`, timings);
    }

    return {
        instance,
        matchedSubscriptionId,
        actions: Object.keys(actionsMap).length > 0 ? actionsMap : undefined,
        executions: executionsList.length > 0 ? executionsList : undefined,
        executionsByDayIndex: Object.keys(executionsByDayIndex).length > 0 ? executionsByDayIndex : undefined,
        nextDayIndex,
        completedDays,
        totalTrainingDays: trainingOnlyDays.length,
        todayCompleted,
        todayExecutionId,
        completionDates,
    };
}

export async function POST(req: Request) {
    const apiStartTime = performance.now();
    const apiTimings: Record<string, number> = {};

    const t0 = performance.now();
    const session = await getServerSession();
    apiTimings['0_get_session'] = performance.now() - t0;

    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const t1 = performance.now();
    const { subscriptionIds } = await req.json() as GetTodayTrainingInstanceDto;
    apiTimings['1_parse_request'] = performance.now() - t1;

    // 并行查询教练计划和自建计划
    const t2 = performance.now();
    const [coachPlanResult, selfPlanResult] = await Promise.allSettled([
        subscriptionIds && subscriptionIds.length > 0
            ? getSingleInstance(userId, session, { subscriptionIds })
            : Promise.resolve(null),
        getSingleInstance(userId, session, { fetchSelf: true }),
    ]);
    apiTimings['2_fetch_plans'] = performance.now() - t2;

    const coachPlan = coachPlanResult.status === 'fulfilled' ? coachPlanResult.value : null;
    const selfPlan = selfPlanResult.status === 'fulfilled' ? selfPlanResult.value : null;

    const totalTime = performance.now() - apiStartTime;
    apiTimings['_total'] = totalTime;

    // 输出性能日志（仅在开发环境或超过阈值时）
    if (process.env.NODE_ENV === 'development' || totalTime > 1500) {
        console.log(`[get-today-training-instance API] Performance timings (${totalTime.toFixed(2)}ms):`, apiTimings);
    }

    return NextResponse.json<ApiData<GetTodayTrainingInstanceResponseDto>>({
        success: true,
        message: "获取今日训练计划成功",
        data: {
            coachPlan,
            selfPlan,
        },
    });
}
