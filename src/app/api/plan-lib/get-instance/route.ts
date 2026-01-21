import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { GetInstanceDto, GetInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { calcIntensityDisplay, normalizeIntensityConfig } from "@/lib/rmCaculator";
import { normalizeToKg } from "@/types/intensity";
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";

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
        subscriptionIds,
        fetchSelf,
    } = await req.json() as GetInstanceDto;

    if (!id && !subscriptionId && !(subscriptionIds && subscriptionIds.length > 0) && !fetchSelf) {
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
    } else if (subscriptionId) {
        query = query
            .eq("coach_subscription_id", subscriptionId)
            // keep consistent with "current plan" semantics used elsewhere (e.g. get-with-executions)
            .in("status", ["active", "paused"])
            .order("created_at", { ascending: false })
            .limit(1);
    } else if (subscriptionIds && subscriptionIds.length > 0) {
        // Batch mode: pick the most recently created instance among given subscription IDs.
        // This matches today-training's "first available plan" behavior but in one request.
        query = query
            .in("coach_subscription_id", subscriptionIds)
            .in("status", ["active", "paused"])
            .order("created_at", { ascending: false })
            .limit(1);
    } else if (fetchSelf) {
        // 仅获取学员自建的计划 (source='self')
        query = query
            .eq("student_id", userId)
            .eq("source", "self") // 必须筛选 source='self'，否则会返回教练计划
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(1);
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

    // Track which subscription matched in batch mode
    const matchedSubscriptionId: string | undefined =
        (subscriptionIds && subscriptionIds.length > 0)
            ? ((instance as any).coach_subscription_id as string | undefined)
            : undefined;

    // 检查用户权限（用户可能同时是教练和学员，需要检查两种身份）
    let hasPermission = false;

    // 1. 检查是否作为教练有权限（如果用户是教练且该计划属于他创建的）
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

    // 2. 如果教练权限不通过，检查是否作为学员有权限
    if (!hasPermission) {
        // 学员权限检查：优先检查 student_id，如果没有则通过 subscription 验证
        if (instance.student_id) {
            if (instance.student_id === userId) {
                hasPermission = true;
            }
        } else if (instance.coach_subscription_id) {
            // 通过 subscription 验证学员权限
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

    // 如果两种身份都没有权限，返回403
    if (!hasPermission) {
        return NextResponse.json({
            success: false,
            message: "权限不足",
        }, { status: 403 });
    }

    // 加载动作详情（教练和学员都需要）
    let actionsMap: Record<string, any> = {};
    if (instance.training_days) {
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
            const idsList = Array.from(actionIds);

            // 1. 查教练动作库
            const { data: coachActions } = await supabase
                .from("coach_actions")
                .select("*")
                .in("id", idsList);

            if (coachActions) {
                coachActions.forEach((action) => {
                    actionsMap[action.id] = action;
                });
            }

            // 2. 查学员动作库 (如果不全都在教练库里)
            const remainingIds = idsList.filter((id) => !actionsMap[id]);

            if (remainingIds.length > 0) {
                const { data: studentActions } = await supabase
                    .from("student_actions")
                    .select("*")
                    .in("id", remainingIds);

                if (studentActions) {
                    studentActions.forEach((action) => {
                        // 适配字段: student_actions 使用 url，coach_actions 使用 video_url
                        actionsMap[action.id] = {
                            ...action,
                            video_url: action.url, // 适配字段
                            is_student_action: true,
                        };
                    });
                }
            }
        }
    }

    // --------------------
    // Student-visible auto load compute (server-side, non-persistent)
    // Ensures student "plan view" shows kg even if only RM/% configured.
    // --------------------
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

            // Re-assign so it shows up in response JSON (mutating instance from Supabase is fine here)
            (instance as any).training_days = days;
        }
    } catch (e) {
        // best-effort; never block plan rendering
        console.warn("[get-instance] auto load compute skipped:", e);
    }

    // 加载执行记录
    let executionsList: any[] = [];
    // NOTE: plan_instance_executions uses `instance_id` (not `plan_instance_id`).
    // Also some environments may not have relational tables for action_executions/execution_sets,
    // so we do a best-effort query with relations, then fallback to a simple select.
    const { data: executions, error: executionsError } = await supabase
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
        .eq("instance_id", instance.id)
        .order("day_index", { ascending: true });

    let effectiveExecutions: any[] | null = executions as any[] | null;
    if (executionsError) {
        // Fallback: get minimal fields we need for nextDayIndex/completionDates.
        const { data: fallbackExecs } = await supabase
            .from("plan_instance_executions")
            .select("id, instance_id, student_id, day_index, status, started_at, completed_at, action_executions")
            .eq("instance_id", instance.id)
            .order("day_index", { ascending: true });
        effectiveExecutions = (fallbackExecs as any[]) || [];
    }

    if (effectiveExecutions) {
        // 处理执行记录，格式化 sets 数据
        executionsList = effectiveExecutions.map((exec: any) => ({
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

    // Build executions map by dayIndex (pick the most recent started_at per day)
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

    // Derive next training day info (compatible with /api/execution/get-next-training-day)
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

    // Resolved days: completed + abandoned (treat abandoned as "skipped" for progress pointer)
    const resolvedExecs = (executionsList || []).filter((e) =>
        (e?.status === "completed" || e?.status === "abandoned") &&
        Number(e?.day_index ?? 0) >= startExecutionDay &&
        trainingOnlyDayIndexSet.has(Number(e?.day_index ?? 0))
    );

    const completionDates: Record<number, string> = {};
    const completedDaySet = new Set<number>();
    for (const e of completedExecs) {
        const di = Number(e.day_index);
        completedDaySet.add(di);
        if (e.completed_at) {
            // keep latest completion date if multiple
            const prev = completionDates[di];
            if (!prev || new Date(e.completed_at).getTime() >= new Date(prev).getTime()) {
                completionDates[di] = e.completed_at;
            }
        }
    }
    const completedDays = Array.from(completedDaySet.values()).sort((a, b) => a - b);

    const resolvedDaySet = new Set<number>();
    for (const e of resolvedExecs) {
        const di = Number(e.day_index);
        if (di) resolvedDaySet.add(di);
    }
    const resolvedDays = Array.from(resolvedDaySet.values()).sort((a, b) => a - b);

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

    // nextDayIndex (legacy): first incomplete training day
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

    // recommendedDayIndex (spec v1): max(resolved) + 1 (next training day)
    let recommendedDayIndex = startExecutionDay;
    if (trainingOnlyDays.length > 0) {
        const maxResolved = resolvedDays.length > 0 ? Math.max(...resolvedDays) : null;
        if (maxResolved === null) {
            recommendedDayIndex = startExecutionDay;
        } else {
            const idx = trainingOnlyDays.findIndex((d) => getDayIndex(d) === maxResolved);
            if (idx >= 0 && idx + 1 < trainingOnlyDays.length) {
                recommendedDayIndex = getDayIndex(trainingOnlyDays[idx + 1]);
            } else {
                // all resolved to the end -> loop or mark complete (keep looping for compatibility)
                recommendedDayIndex = getDayIndex(trainingOnlyDays[0]);
            }
        }
    } else {
        recommendedDayIndex = startExecutionDay;
    }

    // missingDays: unresolved days before recommended pointer
    const missingDays = trainingOnlyDays
        .map((d) => getDayIndex(d))
        .filter((di) => di > 0 && di < recommendedDayIndex && !resolvedDaySet.has(di));

    return NextResponse.json<ApiData<any>>({
        success: true,
        message: "获取训练计划实例成功",
        data: {
            instance,
            matchedSubscriptionId,
            actions: Object.keys(actionsMap).length > 0
                ? actionsMap
                : undefined,
            executions: executionsList.length > 0 ? executionsList : undefined,
            executionsByDayIndex: Object.keys(executionsByDayIndex).length > 0
                ? executionsByDayIndex
                : undefined,
            nextDayIndex,
            recommendedDayIndex,
            completedDays,
            resolvedDays,
            missingDays,
            totalTrainingDays: trainingOnlyDays.length,
            todayCompleted,
            todayExecutionId,
            completionDates,
        },
    });
}
