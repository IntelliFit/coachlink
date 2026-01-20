import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { GetTodayTrainingInstanceDto, GetTodayTrainingInstanceResponseDto } from "./entity";
import type { GetInstanceResponseDto } from "../get-instance/entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { calcIntensityDisplay, normalizeIntensityConfig } from "@/lib/rmCaculator";
import { normalizeToKg } from "@/types/intensity";
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";

// 内部辅助函数：获取单个计划实例（复用 get-instance 的核心逻辑）
async function getSingleInstance(
    userId: string,
    session: any,
    options: {
        subscriptionIds?: string[];
        fetchSelf?: boolean;
    }
): Promise<GetInstanceResponseDto | null> {
    const { subscriptionIds, fetchSelf } = options;

    // 查询计划实例
    let query = supabase
        .from("coach_plan_instances")
        .select("*");

    if (subscriptionIds && subscriptionIds.length > 0) {
        // 批量查询：找到第一个有计划的订阅
        query = query
            .in("coach_subscription_id", subscriptionIds)
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

    if (error || !instance) {
        return null;
    }

    // 检查权限
    let hasPermission = false;

    // 检查教练权限
    if (session.user.is_coach && instance.coach_id) {
        const { data: coach } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", instance.coach_id)
            .single();

        if (coach && coach.user_id === userId) {
            hasPermission = true;
        }
    }

    // 检查学员权限
    if (!hasPermission) {
        if (instance.student_id) {
            if (instance.student_id === userId) {
                hasPermission = true;
            }
        } else if (instance.coach_subscription_id) {
            const { data: subscription } = await supabase
                .from("coach_subscriptions")
                .select("student_id")
                .eq("id", instance.coach_subscription_id)
                .single();

            if (subscription && subscription.student_id === userId) {
                hasPermission = true;
            }
        }
    }

    if (!hasPermission) {
        return null;
    }

    // 加载动作详情
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

    // Auto load compute (计算训练负荷)
    try {
        const targetStudentId: string | null =
            (instance.student_id as string | null) ||
            (instance.coach_subscription_id
                ? (
                    await supabase
                        .from("coach_subscriptions")
                        .select("student_id")
                        .eq("id", instance.coach_subscription_id)
                        .maybeSingle()
                ).data?.student_id || null
                : null);

        if (targetStudentId && Array.isArray(instance.training_days)) {
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("weight")
                .eq("user_id", targetStudentId)
                .maybeSingle();

            const bodyWeight = Number(profile?.weight || 0);

            // Build a 1RM map (ID + Name) for fast lookup
            const records = await getCurrent1RMRecords(userId, { targetUserId: targetStudentId });

            const rmMap: Record<string, number> = {};
            for (const r of records || []) {
                if (r.actionId) rmMap[r.actionId] = Math.max(rmMap[r.actionId] || 0, r.current1RM);
                if (r.actionName) rmMap[r.actionName] = Math.max(rmMap[r.actionName] || 0, r.current1RM);
            }

            const days = instance.training_days as any[];
            for (const day of days) {
                if (!Array.isArray(day.actionSets)) continue;
                for (const set of day.actionSets) {
                    const actionId = set.action_id || set.actionId;
                    if (!actionId) continue;

                    const params = set.params || {};
                    const existingLoad = params.load;
                    if (existingLoad !== null && existingLoad !== undefined) continue; // don't override explicit loads

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
    }

    // 加载执行记录
    let executionsList: any[] = [];
    const { data: executions } = await supabase
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
        .eq("plan_instance_id", instance.id)
        .order("day_index", { ascending: true });

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

    // 构建执行记录映射
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

    // 计算下一个训练日信息
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

    const matchedSubscriptionId: string | undefined =
        (subscriptionIds && subscriptionIds.length > 0)
            ? ((instance as any).coach_subscription_id as string | undefined)
            : undefined;

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
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const { subscriptionIds } = await req.json() as GetTodayTrainingInstanceDto;

    // 并行查询教练计划和自建计划
    const [coachPlanResult, selfPlanResult] = await Promise.allSettled([
        subscriptionIds && subscriptionIds.length > 0
            ? getSingleInstance(userId, session, { subscriptionIds })
            : Promise.resolve(null),
        getSingleInstance(userId, session, { fetchSelf: true }),
    ]);

    const coachPlan = coachPlanResult.status === 'fulfilled' ? coachPlanResult.value : null;
    const selfPlan = selfPlanResult.status === 'fulfilled' ? selfPlanResult.value : null;

    return NextResponse.json<ApiData<GetTodayTrainingInstanceResponseDto>>({
        success: true,
        message: "获取今日训练计划成功",
        data: {
            coachPlan,
            selfPlan,
        },
    });
}
