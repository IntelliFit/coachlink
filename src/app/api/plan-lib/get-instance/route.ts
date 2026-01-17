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
        fetchSelf,
    } = await req.json() as GetInstanceDto;

    // --- DEBUGGING START ---
    try {
        const { data: debugPlans } = await supabase
            .from("coach_plan_instances")
            .select("id, status, source, updated_at, name")
            .eq("student_id", userId)
            .order("updated_at", { ascending: false })
            .limit(5);

        console.log(
            `[get-instance DEBUG] Plans for user ${userId}:`,
            JSON.stringify(debugPlans, null, 2),
        );
    } catch (e) {
        console.error("[get-instance DEBUG] Error listing plans:", e);
    }
    // --- DEBUGGING END ---

    if (!id && !subscriptionId && !fetchSelf) {
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
            .order("created_at", { ascending: false })
            .limit(1);
    } else if (fetchSelf) {
        // 仅获取学员自建的计划 (source='self')
        console.log(
            `[get-instance] Fetching self-created plan for user: ${userId}`,
        );
        query = query
            .eq("student_id", userId)
            .eq("source", "self") // 必须筛选 source='self'，否则会返回教练计划
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(1);
    }

    // 获取计划实例
    const { data: instance, error } = await query.maybeSingle();

    console.log(`[get-instance] Query Result:`, {
        found: !!instance,
        id: instance?.id,
        source: instance?.source,
        error: error?.message,
    });

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
        // 处理执行记录，格式化 sets 数据
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

    return NextResponse.json<ApiData<any>>({
        success: true,
        message: "获取训练计划实例成功",
        data: {
            instance,
            actions: Object.keys(actionsMap).length > 0
                ? actionsMap
                : undefined,
            executions: executionsList.length > 0 ? executionsList : undefined,
        },
    });
}
