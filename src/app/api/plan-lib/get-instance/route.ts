import { buildPlanDayFacts } from '@/lib/planDayFacts';
import { canStartPlanDay, normalizePlanDays, selectPlanAttempt, trainingEntry } from '@coachlink/core/src/trainingAccess';
import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { GetInstanceDto, GetInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import {
    calcIntensityDisplay,
    hasDynamicIntensityTarget,
    normalizeIntensityConfig,
} from "@/lib/rmCaculator";
import { normalizeToKg } from "@/types/intensity";
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";
import { syncCoachActionsToStudentLibrary } from "../sync-actions";
import { addBeijingDays, getBeijingDayStart } from "@/lib/beijingTime";
import {
    evaluateSubscriptionPlanAccess,
    filterTrainingDaysByAccessWindow,
} from "@/lib/subscriptionAccess";
import {
    deriveEffectiveStartExecutionDay,
    deriveStrictSequentialProgressDay,
} from "@/lib/planProgress";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import {
    persistCompletedPlanInstanceIfNeeded,
    summarizePlanCompletion,
} from "@/lib/planInstanceCompletion";
import { deriveSubscriptionEntitlementState } from "@/lib/subscriptionEntitlementModel";
import {
    activatePendingPlanRevisionForSource,
    expireTimedOutPlanExecutions,
} from "@/lib/planExecutionLifecycle";

export async function POST(req: Request) {
    const startTime = performance.now();
    const timings: Record<string, number> = {};

    // Check if user is logged in
    const sessionStart = performance.now();
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id, user: session.user }
        : await getAuthUser(req);
    const userId = authResult.userId || null;
    const authUser = authResult.user || null;
    timings["1_auth"] = performance.now() - sessionStart;

    if (!authResult.isAuthenticated || !userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const paramStart = performance.now();
    const {
        id,
        subscriptionId,
        subscriptionIds,
        fetchSelf,
    } = await req.json() as GetInstanceDto;

    if (
        !id && !subscriptionId &&
        !(subscriptionIds && subscriptionIds.length > 0) && !fetchSelf
    ) {
        return NextResponse.json({
            success: false,
            message: "Invalid parameters",
        });
    }
    timings["1_params"] = performance.now() - paramStart;

    // 2. 查询计划实例
    const queryStart = performance.now();
    let query = supabase
        .from("coach_plan_instances")
        .select("*");

    if (id) {
        query = query.eq("id", id);
    } else if (subscriptionId) {
        query = query
            .eq("coach_subscription_id", subscriptionId)
            // keep consistent with "current plan" semantics used elsewhere (e.g. get-with-executions)
            .in("status", ["active", "paused", "completed"])
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
    const { data: rawInstance, error } = await query.maybeSingle();
    timings["2_query_instance"] = performance.now() - queryStart;

    if (error) {
        console.error("Error fetching instance:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch instance",
        }, { status: 500 });
    }

    if (!rawInstance) {
        return NextResponse.json({
            success: true,
            message: "No plan instance found",
            data: {
                instance: null,
            },
        });
    }

    // Track which subscription matched in batch mode
    let instance: any = rawInstance;

    const matchedSubscriptionId: string | undefined =
        (subscriptionIds && subscriptionIds.length > 0)
            ? ((instance as any).coach_subscription_id as string | undefined)
            : undefined;

    // 3. 检查用户权限（用户可能同时是教练和学员，需要检查两种身份）
    const permissionStart = performance.now();
    let hasPermission = false;
    let hasCoachPermission = false;
    let subscriptionForStudentAccess: any = null;

    // 1. 检查是否作为教练有权限（如果用户是教练且该计划属于他创建的）
    if (authUser?.is_coach && instance.coach_id) {
        const coachCheckStart = performance.now();
        const { data: coach } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", instance.coach_id)
            .single();
        timings["3a_coach_check"] = performance.now() - coachCheckStart;

        if (coach && coach.user_id === userId) {
            hasPermission = true;
            hasCoachPermission = true;
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
            const studentCheckStart = performance.now();
            const { data: subscription } = await supabase
                .from("coach_subscriptions")
                .select("student_id, status, start_date, end_date, subscribed_weeks")
                .eq("id", instance.coach_subscription_id)
                .single();
            timings["3b_student_check"] = performance.now() - studentCheckStart;

            if (subscription && subscription.student_id === userId) {
                hasPermission = true;
                subscriptionForStudentAccess = subscription;
            }
        }
    }
    timings["3_permission"] = performance.now() - permissionStart;

    // 如果两种身份都没有权限，返回403
    if (!hasPermission) {
        return NextResponse.json({
            success: false,
            code: "PERMISSION_DENIED",
            message: "权限不足",
        }, { status: 403 });
    }

    let pendingRevision: any = null;
    try {
        await expireTimedOutPlanExecutions({ instanceId: instance.id });
        const activation = await activatePendingPlanRevisionForSource({
            sourceInstanceId: instance.id,
        });
        if (activation.activated && activation.instance) {
            instance = activation.instance;
        } else if (hasCoachPermission) {
            const { data: queuedRevision } = await supabase
                .from("coach_plan_instances")
                .select("*")
                .eq("revision_of_instance_id", instance.id)
                .eq("status", "scheduled")
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            pendingRevision = queuedRevision || null;
        }
    } catch (lifecycleError) {
        console.warn("[get-instance] plan lifecycle refresh failed:", lifecycleError);
    }

    const isHistoricalInstanceView = !!id &&
        ["completed", "archived"].includes(
            String(instance.status ?? "").trim().toLowerCase(),
        );
    const isCompletedSubscriptionInstance =
        !id &&
        !!subscriptionId &&
        String(instance.status ?? "").trim().toLowerCase() === "completed";
    // 显式按实例 ID 打开的详情页是只读历史查看入口，不应再被订阅门禁直接挡住。
    let shouldBypassSubscriptionGate = !!id || isHistoricalInstanceView || isCompletedSubscriptionInstance;
    if (
        !shouldBypassSubscriptionGate &&
        !!id &&
        !hasCoachPermission &&
        String(instance.status ?? "").trim().toLowerCase() === "active"
    ) {
        const getDayIndex = (day: any) => Number(day?.dayIndex ?? day?.day_index ?? 0);
        const startExecutionDay = Number((instance as any).start_execution_day || 1);
        const trainingDays = (Array.isArray((instance as any).training_days)
            ? (instance as any).training_days
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
            const allTrainingDaysResolved = trainingDayIndexList.every((di: number) =>
                resolvedDaySet.has(di)
            );
            if (allTrainingDaysResolved) {
                shouldBypassSubscriptionGate = true;
            }
        }
    }

    let maxAccessibleDayIndex: number | null = null;
    let effectiveSubscribedWeeks: number | undefined;
    const entitlementTrainingDays = Array.isArray(instance.training_days) ? instance.training_days : [];
    if (
        !shouldBypassSubscriptionGate &&
        !hasCoachPermission &&
        instance.coach_subscription_id
    ) {
        if (!subscriptionForStudentAccess) {
            const { data: subForAccess } = await supabase
                .from("coach_subscriptions")
                .select("id, student_id, status, start_date, end_date, subscribed_weeks")
                .eq("id", instance.coach_subscription_id)
                .eq("student_id", userId)
                .maybeSingle();
            subscriptionForStudentAccess = subForAccess;
        }
        if (!subscriptionForStudentAccess) {
            return NextResponse.json({
                success: false,
                code: "PERMISSION_DENIED",
                message: "权限不足",
            }, { status: 403 });
        }

        const { data: completedExecutionsForAccess } = await supabase
            .from("plan_instance_executions")
            .select("day_index, status")
            .eq("instance_id", instance.id)
            .eq("status", "completed");

        const carryover = await getSubscriptionCarryoverSummary({
            subscriptionId: String(instance.coach_subscription_id || ""),
            subscribedWeeks: Number(
                subscriptionForStudentAccess?.subscribed_weeks || 0,
            ),
            excludeInstanceId: String(instance.id || ""),
            createdBefore: (instance as any)?.created_at || null,
            subscriptionStartDate:
                (subscriptionForStudentAccess as any)?.start_date || null,
        });

        const decision = evaluateSubscriptionPlanAccess({
            subscription: subscriptionForStudentAccess,
            trainingDays: Array.isArray((instance as any).training_days)
                ? ((instance as any).training_days as any[])
                : [],
            executions: (completedExecutionsForAccess || []).map((exec: any) => ({
                day_index: Number(exec?.day_index ?? 0),
                status: exec?.status || "completed",
            })),
            startExecutionDay: Number((instance as any).start_execution_day || 1),
            effectiveSubscribedWeeks: carryover.remainingWeeks,
        });
        effectiveSubscribedWeeks = carryover.remainingWeeks;
        if (!decision.allowed) {
            const code = decision.reason === "SUBSCRIPTION_EXPIRED"
                ? "SUBSCRIPTION_EXPIRED"
                : "PLAN_OUT_OF_SCOPE";
            const message = decision.reason === "SUBSCRIPTION_EXPIRED"
                ? "订阅已过期，请续费后继续训练"
                : "当前训练内容不在订阅范围内";
            return NextResponse.json({
                success: false,
                code,
                data: {
                    accessStatus: "blocked",
                    reason: decision.reason,
                    maxAccessibleDayIndex: decision.maxAccessibleDayIndex,
                    instanceId: instance.id,
                    subscriptionId: instance.coach_subscription_id,
                },
                message,
            }, { status: 403 });
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
        return NextResponse.json({
            success: false,
            code: "PLAN_OUT_OF_SCOPE",
            data: {
                accessStatus: "blocked",
                reason: "PLAN_OUT_OF_SCOPE",
                maxAccessibleDayIndex,
                instanceId: instance.id,
                subscriptionId: instance.coach_subscription_id,
            },
            message: "当前训练内容不在订阅范围内",
        }, { status: 403 });
    }

    let syncTargetStudentId: string | null =
        (instance.student_id as string | null) || null;
    if (!syncTargetStudentId && instance.coach_subscription_id) {
        const { data: subForSync } = await supabase
            .from("coach_subscriptions")
            .select("student_id")
            .eq("id", instance.coach_subscription_id)
            .maybeSingle();
        syncTargetStudentId = subForSync?.student_id || null;
    }

    // 4. 加载动作详情（教练和学员都需要）
    const actionsStart = performance.now();
    let actionsMap: Record<string, any> = {};
    const planActionIds = new Set<string>();
    if (instance.training_days) {
        const trainingDays = instance.training_days as any[];

        // 收集所有 action_id（兼容 actionId 和 action_id 两种字段名）
        trainingDays.forEach((day: any) => {
            day.actionSets?.forEach((set: any) => {
                // 支持两种字段名: action_id 和 actionId
                const actionId = set.action_id || set.actionId;
                if (actionId) {
                    planActionIds.add(actionId);
                }
            });
        });

        // 批量获取动作详情
        if (planActionIds.size > 0) {
            const idsList = Array.from(planActionIds);

            // 1. 查教练动作库
            const coachActionsStart = performance.now();
            const { data: coachActions } = await supabase
                .from("coach_actions")
                .select("*")
                .in("id", idsList);
            timings["4a_coach_actions"] = performance.now() - coachActionsStart;

            if (coachActions) {
                coachActions.forEach((action) => {
                    actionsMap[action.id] = action;
                });

                // 教练计划涉及的动作自动同步到学员动作库，便于后续按动作维护全局1RM。
                if (syncTargetStudentId && instance.coach_subscription_id) {
                    await syncCoachActionsToStudentLibrary(
                        syncTargetStudentId,
                        coachActions as any[],
                        planActionIds,
                    );
                }
            }

            // 2. 查学员动作库 (如果不全都在教练库里)
            const remainingIds = idsList.filter((id) => !actionsMap[id]);

            if (remainingIds.length > 0) {
                const studentActionsStart = performance.now();
                const { data: studentActions } = await supabase
                    .from("student_actions")
                    .select("*")
                    .in("id", remainingIds);
                timings["4b_student_actions"] = performance.now() -
                    studentActionsStart;

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
    timings["4_actions"] = performance.now() - actionsStart;

    // 5. Student-visible auto load compute (server-side, non-persistent)
    // Ensures student "plan view" shows kg even if only RM/% configured.
    const autoLoadStart = performance.now();
    let aggregated1RM: Record<string, number> = {};
    try {
        const targetStudentStart = performance.now();
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
        timings["5a_target_student"] = performance.now() - targetStudentStart;

        if (targetStudentId && Array.isArray(instance.training_days)) {
            const profileStart = performance.now();
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("weight")
                .eq("user_id", targetStudentId)
                .maybeSingle();
            timings["5b_profile"] = performance.now() - profileStart;

            const bodyWeight = Number(profile?.weight || 0);
            const planActionNames = new Set<string>();
            for (const action of Object.values(actionsMap || {})) {
                const name = String((action as any)?.name || "").trim();
                if (name) planActionNames.add(name);
            }

            // Build a 1RM map (ID + Name) for fast lookup
            const rmRecordsStart = performance.now();
            const records = await getCurrent1RMRecords(userId, {
                targetUserId: targetStudentId,
                actionIds: planActionIds.size > 0 ? Array.from(planActionIds) : undefined,
                actionNames: planActionNames.size > 0 ? Array.from(planActionNames) : undefined,
                // 计划负荷统一按 PR 递增逻辑计算，避免状态波动导致自动降重。
                // 学员若需下调，必须通过手动编辑动作库 reference_1rm。
                preferPR: true,
            }, {
                // 本路由上方已经验证当前用户是该计划的教练或学员。
                authorizationVerified: true,
            });
            timings["5c_rm_records"] = performance.now() - rmRecordsStart;

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
                if (r.canonicalActionId && r.current1RM > 0) {
                    rmMap[r.canonicalActionId] = r.current1RM;
                }
            }
            aggregated1RM = rmMap;

            const calcStart = performance.now();
            const days = instance.training_days as any[];
            for (const day of days) {
                if (!Array.isArray(day.actionSets)) continue;
                for (const set of day.actionSets) {
                    const actionId = set.action_id || set.actionId;
                    if (!actionId) continue;

                    const params = set.params || {};
                    const existingLoad = params.load;
                    const intensityConfig = normalizeIntensityConfig(params);
                    const legacyRm = params["强度"] ?? set.intensity;
                    const shouldRefreshExistingLoad = params.fixedLoadOverride === true ? false : hasDynamicIntensityTarget({
                        intensityConfig,
                        legacyRm,
                    });
                    // 固定重量（无 RM/%）保持原值；动态强度（RM/%）即使已有旧 load 也要重算。
                    if (
                        !shouldRefreshExistingLoad &&
                        existingLoad !== null &&
                        existingLoad !== undefined
                    ) {
                        continue;
                    }
                    const canonicalActionId = actionsMap[actionId]?.canonical_action_id ??
                        actionsMap[actionId]?.canonicalActionId;
                    const oneRM = rmMap[canonicalActionId] ??
                        rmMap[actionsMap[actionId]?.name] ??
                        rmMap[set.actionName] ??
                        rmMap[actionId] ?? undefined;

                    // resolve includesBodyWeight from action row if present
                    const includesBodyWeight =
                        !!(actionsMap[actionId]?.includesBodyWeight ??
                            actionsMap[actionId]?.includes_body_weight);

                    const result = calcIntensityDisplay({
                        intensityConfig,
                        legacyRm,
                        oneRM,
                        bodyWeight,
                        includesBodyWeight,
                    });

                    if (
                        result.displayWeight !== null &&
                        result.displayWeight !== undefined
                    ) {
                        const kg = normalizeToKg(
                            Number(result.displayWeight),
                            result.displayUnit || "kg",
                        );
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
            timings["5d_calc_load"] = performance.now() - calcStart;

            // Re-assign so it shows up in response JSON (mutating instance from Supabase is fine here)
            (instance as any).training_days = days;
        }
    } catch (e) {
        // best-effort; never block plan rendering
        console.warn("[get-instance] auto load compute skipped:", e);
    }
    timings["5_auto_load"] = performance.now() - autoLoadStart;

    // 6. 加载执行记录
    let executionsList: any[] = [];
    // NOTE: plan_instance_executions uses `instance_id` (not `plan_instance_id`).
    // Also some environments may not have relational tables for action_executions/execution_sets,
    // so we do a best-effort query with relations, then fallback to a simple select.
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
    const { data: executions, error: executionsError } = await executionsQuery
        .order("day_index", { ascending: true });

    let effectiveExecutions: any[] | null = executions as any[] | null;
    if (executionsError) {
        // JSONB-backed environments have no relational execution_sets table.
        let fallbackQuery = supabase
            .from("plan_instance_executions")
            .select(
                "*",
            )
            .eq("instance_id", instance.id);
        if (maxAccessibleDayIndex !== null) {
            fallbackQuery = fallbackQuery.lte("day_index", maxAccessibleDayIndex);
        }
        const { data: fallbackExecs, error: fallbackError } = await fallbackQuery.order("day_index", {
            ascending: true,
        });
        if (fallbackError) return NextResponse.json({ success: false,
            message: '暂时无法读取训练历史，请稍后重试', code: 'EXECUTION_HISTORY_UNAVAILABLE' }, { status: 503 });
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
                    has_video: Array.isArray(s.video) ? !!s.video.length : !!s.has_video,
                    video_url: s.video?.[0]?.video_url || s.video_url,
                })),
            })),
        }));
    }

    // Build executions map by dayIndex. An active attempt is always shown;
    // otherwise a completed attempt must win over a newer empty/abandoned
    // replacement created while confirming an older timed-out workout.
    const executionsByDayIndex: Record<number, any> = {};
    for (const exec of executionsList || []) {
        const di = Number(exec?.day_index ?? 0);
        if (!di) continue;
        const prev = executionsByDayIndex[di];
        if (!prev) {
            executionsByDayIndex[di] = exec;
            continue;
        }
        executionsByDayIndex[di] = selectPlanAttempt([prev, exec]);
    }

    // 7. Derive progress day info
    const nextDayStart = performance.now();
    const storedStartExecutionDay = Number(
        (instance as any).start_execution_day || 1,
    );
    const getDayIndex = (d: any) => Number(d?.dayIndex ?? d?.day_index ?? 0);
    let subscriptionStartDateForProgress: string | Date | null = null;
    if (instance.coach_subscription_id) {
        if (subscriptionForStudentAccess?.start_date) {
            subscriptionStartDateForProgress = subscriptionForStudentAccess.start_date;
        } else {
            const { data: subForProgress } = await supabase
                .from("coach_subscriptions")
                .select("start_date")
                .eq("id", instance.coach_subscription_id)
                .maybeSingle();
            subscriptionStartDateForProgress = subForProgress?.start_date || null;
        }
    }
    const progressFacts = buildPlanDayFacts(executionsList);
    const startExecutionDay = deriveEffectiveStartExecutionDay({
        storedStartExecutionDay,
        planDays: Array.isArray(instance.training_days)
            ? (instance.training_days as any[])
            : [],
        executionsByDayIndex: progressFacts,
        planStartDate: (instance as any).start_date,
        subscriptionStartDate: subscriptionStartDateForProgress,
    });
    if (startExecutionDay !== storedStartExecutionDay) {
        (instance as any).start_execution_day = startExecutionDay;
        (instance as any).stored_start_execution_day = storedStartExecutionDay;
    }
    const planDays =
        normalizePlanDays(Array.isArray(instance.training_days) ? instance.training_days as any[] : [])
            .slice()
            .filter((d) => getDayIndex(d) >= startExecutionDay)
            .sort((a, b) => getDayIndex(a) - getDayIndex(b));
    const trainingDays = planDays;

    const trainingOnlyDays = trainingDays.filter((d) =>
        d?.type === "training"
    );
    const trainingOnlyDayIndexSet = new Set(
        trainingOnlyDays.map((d) => getDayIndex(d)),
    );

    const completedExecs = (executionsList || []).filter((e) =>
        e?.status === "completed" &&
        Number(e?.day_index ?? 0) >= startExecutionDay &&
        trainingOnlyDayIndexSet.has(Number(e?.day_index ?? 0))
    );

    // Training resolved days: completed + abandoned
    const trainingResolvedExecs = (executionsList || []).filter((e) =>
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
            if (
                !prev ||
                new Date(e.completed_at).getTime() >= new Date(prev).getTime()
            ) {
                completionDates[di] = e.completed_at;
            }
        }
    }
    const completedDays = Array.from(completedDaySet.values()).sort((a, b) =>
        a - b
    );

    const completionSummary = summarizePlanCompletion({
        trainingDays: Array.isArray(instance.training_days)
            ? (instance.training_days as any[])
            : [],
        startExecutionDay,
        executions: (executionsList || []).map((exec: any) => ({
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

    // todayCompleted + todayExecutionId
    const todayStart = getBeijingDayStart(new Date());
    const tomorrow = addBeijingDays(todayStart, 1);
    const todayExecution = completedExecs.find((e) => {
        if (!e?.completed_at) return false;
        const dt = new Date(e.completed_at);
        return dt >= todayStart && dt < tomorrow;
    });
    const todayCompleted = !!todayExecution;
    const todayExecutionId = todayExecution?.id;

    timings["7_next_day"] = performance.now() - nextDayStart;

    const { recommendedDayIndex, resolvedDays } = deriveStrictSequentialProgressDay(
        {
            planDays,
            startExecutionDay,
            executionsByDayIndex: progressFacts,
            actionsMap,
            explicitStartDate:
                (instance as any).start_date || (instance as any).created_at ||
                subscriptionStartDateForProgress,
            today: todayStart,
        },
    );

    // Legacy alias uses the same sequence decision, including explicit skipped days.
    const nextDayIndex = planDays.find(day => canStartPlanDay({ trainingDays: planDays,
        progressDayIndex: recommendedDayIndex, targetDayIndex: getDayIndex(day), executionsByDayIndex: progressFacts,
    }))?.dayIndex ?? recommendedDayIndex;

    // missingDays: unresolved training days before recommended pointer
    const missingDays = trainingOnlyDays
        .map((d) => getDayIndex(d))
        .filter((di) =>
            di > 0 && di < recommendedDayIndex &&
            !completionSummary.resolvedDaySet.has(di)
        );
    const isLogicallyCompleted = completionSummary.isLogicallyCompleted;
    const normalizedStatus = String((instance as any).status || "")
        .trim()
        .toLowerCase();
    const derivedStatus = normalizedStatus === "active" && isLogicallyCompleted
        ? "completed"
        : (instance as any).status;

    if (effectiveSubscribedWeeks === undefined && subscriptionForStudentAccess && instance.coach_subscription_id) {
        const carryover = await getSubscriptionCarryoverSummary({
            subscriptionId: String(instance.coach_subscription_id),
            subscribedWeeks: Number(subscriptionForStudentAccess.subscribed_weeks || 0),
            excludeInstanceId: String(instance.id), createdBefore: instance.created_at || null,
            subscriptionStartDate: subscriptionForStudentAccess.start_date || null,
        });
        effectiveSubscribedWeeks = carryover.remainingWeeks;
    }
    const entitlement = subscriptionForStudentAccess && instance.coach_subscription_id
        ? deriveSubscriptionEntitlementState({
            subscription: subscriptionForStudentAccess,
            planInstance: { ...instance, training_days: entitlementTrainingDays } as any,
            executions: (executionsList || []).map((exec: any) => ({
                day_index: Number(exec?.day_index ?? 0),
                status: exec?.status || null,
                completed_at: exec?.completed_at || null,
                updated_at: exec?.updated_at || null,
            })),
            effectiveSubscribedWeeks: effectiveSubscribedWeeks ?? Number(subscriptionForStudentAccess?.subscribed_weeks || 0),
        })
        : null;

    // 计算总耗时
    timings["total"] = performance.now() - startTime;

    return NextResponse.json<ApiData<GetInstanceResponseDto>>({
        success: true,
        message: "获取训练计划实例成功",
        data: {
            instance,
            pendingRevision,
            matchedSubscriptionId,
            actions: Object.keys(actionsMap).length > 0
                ? actionsMap
                : undefined,
            aggregated1RM,
            executions: executionsList.length > 0 ? executionsList : undefined,
            executionsByDayIndex: Object.keys(executionsByDayIndex).length > 0
                ? executionsByDayIndex
                : undefined,
            nextDayIndex,
            recommendedDayIndex,
            entryDecisions: Object.fromEntries(planDays.map(day => [getDayIndex(day), trainingEntry({
                trainingDays: planDays, progressDayIndex: recommendedDayIndex, targetDayIndex: getDayIndex(day),
                execution: executionsByDayIndex[getDayIndex(day)], executionsByDayIndex: progressFacts,
            })])),
            completedDays,
            resolvedDays,
            missingDays,
            totalTrainingDays: completionSummary.overallTotalTrainingDays,
            todayCompleted,
            todayExecutionId,
            completionDates,
            resolvedTrainingDays: completionSummary.overallResolvedTrainingDays,
            isLogicallyCompleted,
            derivedStatus,
            entitlement,
        },
    });
}
