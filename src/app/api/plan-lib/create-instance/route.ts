import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { CreateInstanceDto, CreateInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { sendDirectMessage } from "@/lib/chat";
import { syncCoachActionsToStudentLibrary } from "../sync-actions";
import { validateTrainingDaysPresence } from "@/utils/template";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";
import {
    markPlanInstanceAsCarriedRevisionNoCharge,
    reconcileCurrentPlanInstancesForSubscription,
} from "@/lib/subscriptionEntitlement";
import { toBeijingDateKey } from "@/lib/beijingTime";
import { expireTimedOutPlanExecutions } from "@/lib/planExecutionLifecycle";
import {
    describeLockedPlanDayViolation,
    findLockedPlanDayViolation,
    getLockedThroughDayIndex,
} from "@coachlink/core/src/planEditLock";

export async function POST(req: Request) {
    const {
        name,
        description,
        executionNotice,
        templateId,
        subscriptionId,
        startDate,
        endDate,
        status,
        type,
        suitableFor,
        tags,
        trainingDays,
        revisionOfInstanceId,
        startWeek,
        startDay,
    } = await req.json() as CreateInstanceDto;

    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!name || !trainingDays) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数",
        }, { status: 400 });
    }

    const trainingDaysPresence = validateTrainingDaysPresence(trainingDays);
    if (!trainingDaysPresence.valid) {
        return NextResponse.json({
            success: false,
            message: trainingDaysPresence.message,
        }, { status: 400 });
    }

    const { data: subscription, error: subscriptionError } = await supabase
        .from("coach_subscriptions")
        .select("coach_id, student_id, subscribed_weeks, start_date")
        .eq("id", subscriptionId)
        .single();

    if (subscriptionError) {
        return NextResponse.json({
            success: false,
            message: subscriptionError.message,
        }, { status: 500 });
    }

    const { data: subscriptionCoach } = await serviceRoleSupabase
        .from("coaches")
        .select("user_id")
        .eq("id", subscription.coach_id)
        .maybeSingle();
    if (!subscriptionCoach || subscriptionCoach.user_id !== userId) {
        return NextResponse.json({
            success: false,
            message: "无权为该订阅创建计划",
        }, { status: 403 });
    }

    let revisionSource: {
        id: string;
        start_date?: string | null;
        start_execution_day?: number | null;
        training_days?: unknown;
    } | null = null;
    let activationPending = false;
    let activationAfterExecutionId: string | null = null;

    if (revisionOfInstanceId) {
        const { data: source, error: sourceError } = await serviceRoleSupabase
            .from("coach_plan_instances")
            .select("id, coach_subscription_id, start_date, start_execution_day, status, training_days")
            .eq("id", revisionOfInstanceId)
            .maybeSingle();

        if (
            sourceError ||
            !source ||
            source.coach_subscription_id !== subscriptionId ||
            !["active", "paused"].includes(String(source.status || ""))
        ) {
            return NextResponse.json({
                success: false,
                message: "要更新的当前计划不存在或已发生变化，请刷新后重试",
            }, { status: 409 });
        }

        revisionSource = source;
        await expireTimedOutPlanExecutions({ instanceId: revisionOfInstanceId });
        const { data: resolvedExecutions, error: resolvedExecutionsError } =
            await serviceRoleSupabase
                .from("plan_instance_executions")
                .select("id, day_index, status, started_at")
                .eq("instance_id", revisionOfInstanceId);

        if (resolvedExecutionsError) {
            return NextResponse.json({
                success: false,
                message: "读取当前计划训练进度失败，请重试",
            }, { status: 500 });
        }

        const activeExecutions = (resolvedExecutions || [])
            .filter((execution: any) =>
                String(execution?.status || "").toLowerCase() === "in_progress"
            )
            .sort((left: any, right: any) =>
                new Date(right?.started_at || 0).getTime() -
                new Date(left?.started_at || 0).getTime()
            );
        activationPending = activeExecutions.length > 0;
        activationAfterExecutionId = activeExecutions[0]?.id || null;

        // Updating in place keeps every workout attached by day_index, so days
        // up to the furthest workout must keep their structure.
        const lockedThroughDayIndex = getLockedThroughDayIndex(resolvedExecutions || []);
        const violation = Array.isArray(trainingDays)
            ? findLockedPlanDayViolation({
                savedDays: (source as any).training_days,
                nextDays: trainingDays as any[],
                lockedThroughDayIndex,
            })
            : null;
        if (violation) {
            return NextResponse.json({
                success: false,
                code: "PLAN_DAYS_LOCKED",
                message: describeLockedPlanDayViolation(violation, lockedThroughDayIndex),
                data: { lockedThroughDayIndex, dayIndex: violation.dayIndex },
            }, { status: 409 });
        }
    }

    let normalizedExecutionNotice = executionNotice?.trim() || null;
    if (executionNotice === undefined && templateId) {
        const { data: template } = await supabase
            .from("coach_plan_templates")
            .select("execution_notice")
            .eq("id", templateId)
            .eq("coach_id", userId)
            .maybeSingle();
        normalizedExecutionNotice = (template as any)?.execution_notice || null;
    }

    // Calculate start_execution_day if provided (migration mid-cycle)
    const normalizedStartWeek = Number(startWeek ?? 1);
    const normalizedStartDay = Number(startDay ?? 1);
    const hasExplicitStartPosition =
        (startWeek !== undefined || startDay !== undefined) &&
        ((Number.isFinite(normalizedStartWeek) && normalizedStartWeek > 1) ||
            (Number.isFinite(normalizedStartDay) && normalizedStartDay > 1));
    const hasStartPosition = Number.isFinite(normalizedStartWeek) &&
        Number.isFinite(normalizedStartDay) &&
        normalizedStartWeek >= 1 &&
        normalizedStartDay >= 1 &&
        normalizedStartDay <= 7;

    let startExecutionDay = hasStartPosition
        ? (normalizedStartWeek - 1) * 7 + normalizedStartDay
        : 1;

    if (!revisionSource && !hasExplicitStartPosition && Array.isArray(trainingDays)) {
        const carryover = await getSubscriptionCarryoverSummary({
            subscriptionId,
            subscribedWeeks: Number((subscription as any)?.subscribed_weeks || 0),
            subscriptionStartDate: (subscription as any)?.start_date || null,
        });

        if (carryover.exhausted) {
            return NextResponse.json({
                success: false,
                message: "当前订阅剩余周期已耗尽，请续费后再创建新计划",
            }, { status: 400 });
        }

        startExecutionDay = 1;
    }

    if (revisionSource) {
        // The update keeps the same instance and its workouts, so progress
        // continues on its own. Moving start_execution_day forward would turn
        // skipped days into charged "carried" progress.
        startExecutionDay = Math.max(1, Number(revisionSource.start_execution_day || 1));
    }

    if (hasStartPosition && Array.isArray(trainingDays)) {
        const totalDays = (trainingDays as any[]).length;
        if (startExecutionDay > totalDays) {
            return NextResponse.json({
                success: false,
                message:
                    `起始位置(第${normalizedStartWeek}周第${normalizedStartDay}天)超出计划总天数(${totalDays}天)`,
            }, { status: 400 });
        }
    }

    const subscriptionStartDate = subscription.start_date
        ? toBeijingDateKey(subscription.start_date)
        : null;
    const requestedStartDate = startDate ? toBeijingDateKey(startDate) : null;
    const revisionStartDate = revisionSource?.start_date
        ? String(revisionSource.start_date).slice(0, 10)
        : null;
    // D1 is established by the first real execution. A fresh plan therefore
    // has no fixed start_date. Only a carried revision/mid-cycle migration may
    // preserve an already-known calendar anchor.
    const resolvedStartDate = revisionSource
        ? revisionStartDate || subscriptionStartDate || requestedStartDate
        : startExecutionDay > 1
            ? subscriptionStartDate || requestedStartDate
            : null;

    // "Update current plan" must keep the same instance id so every existing
    // execution, video and personal record remains attached and visible. Each
    // execution already stores its own immutable action snapshot, so updating
    // the plan definition in place cannot rewrite historical workout data.
    if (revisionSource) {
        const nowIso = new Date().toISOString();
        const { data: updatedInstance, error: updateError } = await serviceRoleSupabase
            .from("coach_plan_instances")
            .update({
                name,
                description: description || null,
                execution_notice: normalizedExecutionNotice,
                coach_plan_template_id: templateId || null,
                start_date: resolvedStartDate,
                end_date: endDate || null,
                tags: tags || null,
                type: type || null,
                suitable_for: suitableFor || null,
                training_days: trainingDays,
                start_execution_day: startExecutionDay > 1 ? startExecutionDay : 1,
                updated_at: nowIso,
            })
            .eq("id", revisionSource.id)
            .eq("coach_subscription_id", subscriptionId)
            .in("status", ["active", "paused"])
            .select()
            .maybeSingle();

        if (updateError || !updatedInstance) {
            console.error("[create-instance] Failed to update current instance in place:", updateError);
            return NextResponse.json({
                success: false,
                message: "当前计划已发生变化，请刷新后重试",
            }, { status: 409 });
        }

        await serviceRoleSupabase
            .from("coach_plan_instances")
            .update({
                status: "archived",
                archive_reason: "superseded_pending_update",
                entitlement_consumption_policy: "no_charge",
                activation_after_execution_id: null,
                activation_reason: null,
                updated_at: nowIso,
            })
            .eq("revision_of_instance_id", revisionSource.id)
            .eq("status", "scheduled");

        try {
            const studentId = subscription.student_id as string | null;
            if (studentId && Array.isArray(trainingDays)) {
                const actionIds = new Set<string>();
                trainingDays.forEach((day: any) => {
                    day.actionSets?.forEach((set: any) => {
                        const actionId = set.action_id || set.actionId;
                        if (actionId) actionIds.add(actionId);
                    });
                });
                if (actionIds.size > 0) {
                    const { data: coachActions } = await supabase
                        .from("coach_actions")
                        .select("*")
                        .in("id", Array.from(actionIds));
                    if (coachActions?.length) {
                        await syncCoachActionsToStudentLibrary(
                            studentId,
                            coachActions as any[],
                            actionIds,
                        );
                    }
                }
            }
        } catch (syncError) {
            console.warn("[create-instance] Failed to sync updated plan actions:", syncError);
        }

        return NextResponse.json<ApiData<CreateInstanceResponseDto>>({
            success: true,
            message: "更新训练计划成功",
            data: {
                instance: updatedInstance as any,
                activationPending: false,
                activationAfterExecutionId: null,
                updatedExisting: true,
            },
        });
    }

    const effectiveStatus = activationPending ? "scheduled" : status || "active";
    const instancePayload = {
        name,
        description: description || null,
        execution_notice: normalizedExecutionNotice,
        coach_subscription_id: subscriptionId,
        coach_id: subscription.coach_id || null,
        student_id: subscription.student_id || null,
        coach_plan_template_id: templateId || null,
        start_date: resolvedStartDate,
        end_date: endDate || null,
        tags: tags || null,
        type: type || null,
        suitable_for: suitableFor || null,
        status: effectiveStatus,
        training_days: trainingDays,
        start_execution_day: startExecutionDay > 1 ? startExecutionDay : 1,
        revision_of_instance_id: revisionSource?.id || null,
        activation_after_execution_id: activationPending ? activationAfterExecutionId : null,
        activation_reason: activationPending ? "execution_in_progress" : null,
        activated_at: activationPending ? null : new Date().toISOString(),
        ...(activationPending && { entitlement_consumption_policy: "no_charge" }),
        updated_at: new Date().toISOString(),
    };

    let instance: any = null;
    let error: any = null;
    if (activationPending && revisionSource) {
        const { data: existingPending, error: pendingQueryError } = await serviceRoleSupabase
            .from("coach_plan_instances")
            .select("id")
            .eq("revision_of_instance_id", revisionSource.id)
            .eq("status", "scheduled")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (pendingQueryError) {
            error = pendingQueryError;
        } else if (existingPending) {
            const result = await serviceRoleSupabase
                .from("coach_plan_instances")
                .update(instancePayload)
                .eq("id", existingPending.id)
                .eq("status", "scheduled")
                .select()
                .single();
            instance = result.data;
            error = result.error;
        } else {
            const result = await serviceRoleSupabase
                .from("coach_plan_instances")
                .insert(instancePayload)
                .select()
                .single();
            instance = result.data;
            error = result.error;
        }
    } else {
        const result = await serviceRoleSupabase
            .from("coach_plan_instances")
            .insert(instancePayload)
            .select()
            .single();
        instance = result.data;
        error = result.error;
    }

    if (error) {
        // Once the database single-current constraint is deployed, two truly
        // concurrent creates may race. The constraint rejects the loser; if
        // both requests carried the same plan, return the already-published
        // instance so a double tap remains idempotent.
        if ((error as any)?.code === "23505" && subscriptionId) {
            if (activationPending && revisionSource) {
                const { data: concurrentPending } = await serviceRoleSupabase
                    .from("coach_plan_instances")
                    .select("*")
                    .eq("revision_of_instance_id", revisionSource.id)
                    .eq("status", "scheduled")
                    .order("updated_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                const isEquivalentPendingSave = !!concurrentPending &&
                    String(concurrentPending.name || "") === String(name || "") &&
                    JSON.stringify(concurrentPending.training_days || []) === JSON.stringify(trainingDays || []);
                if (isEquivalentPendingSave) {
                    return NextResponse.json<ApiData<CreateInstanceResponseDto>>({
                        success: true,
                        message: "计划新版本已保存，等待当前训练结束后生效",
                        data: {
                            instance: concurrentPending as any,
                            activationPending: true,
                            activationAfterExecutionId,
                        },
                    });
                }
            }
            const { data: concurrentCurrent } = await serviceRoleSupabase
                .from("coach_plan_instances")
                .select("*")
                .eq("coach_subscription_id", subscriptionId)
                .in("status", ["active", "paused"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            const isEquivalentConcurrentCreate = !!concurrentCurrent &&
                String(concurrentCurrent.name || "") === String(name || "") &&
                JSON.stringify(concurrentCurrent.training_days || []) === JSON.stringify(trainingDays || []);
            if (isEquivalentConcurrentCreate) {
                return NextResponse.json<ApiData<CreateInstanceResponseDto>>({
                    success: true,
                    message: "训练计划已创建",
                    data: { instance: concurrentCurrent as any },
                });
            }
            return NextResponse.json({
                success: false,
                code: "PLAN_CREATE_CONFLICT",
                message: "计划正在被另一项操作更新，请刷新后重试",
            }, { status: 409 });
        }
        console.error("Error creating instance:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to create instance",
        }, { status: 500 });
    }

    if (revisionSource && !activationPending) {
        try {
            // The database single-current trigger may already have archived the
            // source as replaced_counted before this insert returned. Correct
            // that exact row explicitly; querying only current rows is too late.
            await markPlanInstanceAsCarriedRevisionNoCharge({
                supabase: serviceRoleSupabase,
                instanceId: revisionSource.id,
                subscriptionId,
            });
        } catch (revisionArchiveError: any) {
            console.error(
                "[create-instance] Failed to mark source revision as no-charge:",
                revisionArchiveError,
            );
            return NextResponse.json({
                success: false,
                code: "PLAN_REVISION_ARCHIVE_FAILED",
                message: "计划新版本已建立，但旧版本权益校正失败，请勿重复提交并联系管理员",
            }, { status: 500 });
        }
    }

    // Converge by a deterministic newest-row rule. Every concurrent request
    // chooses the same winner, so requests cannot archive each other's row and
    // leave two current plans behind.
    const shouldReplaceCurrent = instance.status === "active" || instance.status === "paused";
    let publishedInstance = instance;
    if (shouldReplaceCurrent) {
        try {
            const reconciliation = await reconcileCurrentPlanInstancesForSubscription({
                supabase: serviceRoleSupabase,
                subscriptionId,
                forceNoChargeInstanceIds: revisionSource ? [revisionSource.id] : [],
            });
            if (reconciliation.currentInstanceId && reconciliation.currentInstanceId !== instance.id) {
                const { data: resolvedCurrent, error: resolvedCurrentError } = await serviceRoleSupabase
                    .from("coach_plan_instances")
                    .select("*")
                    .eq("id", reconciliation.currentInstanceId)
                    .single();
                if (resolvedCurrentError || !resolvedCurrent) {
                    throw new Error(resolvedCurrentError?.message || "无法读取并发创建后的当前计划");
                }
                publishedInstance = resolvedCurrent as any;
            }
        } catch (archiveError: any) {
            console.error("[create-instance] Failed to converge current instances:", archiveError);
            return NextResponse.json({
                success: false,
                code: "PLAN_CURRENT_RECONCILIATION_FAILED",
                message: "计划已保存，但当前版本校验失败，请刷新后重试",
            }, { status: 500 });
        }
    }

    // 同步教练计划中的动作到学员动作库
    try {
        const studentId = subscription.student_id as string | null;
        if (publishedInstance.id === instance.id && studentId && Array.isArray(trainingDays)) {
            // 提取计划中使用的所有动作ID
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
                // 查询教练动作库
                const idsList = Array.from(actionIds);
                const { data: coachActions } = await supabase
                    .from("coach_actions")
                    .select("*")
                    .in("id", idsList);

                if (coachActions && coachActions.length > 0) {
                    await syncCoachActionsToStudentLibrary(
                        studentId,
                        coachActions as any[],
                        actionIds,
                    );
                }
            }
        }
    } catch (e) {
        // best-effort; do not block instance creation
        console.warn("[create-instance] Failed to sync actions to student library:", e);
    }

    // best-effort: notify student via chat message
    try {
        const studentId = subscription.student_id as string | null;
        if (!activationPending && publishedInstance.id === instance.id && studentId) {
            const planName = name?.trim() || "训练计划";
            const content = `✅ 你的训练计划已制定完成：**${planName}**\n\n` +
                `请点击 [今日训练](/today-training) 查看并开始训练。`;

            await sendDirectMessage({
                fromUserId: userId,
                toUserId: studentId,
                content,
                contentMetadata: {
                    kind: "plan_instance_created",
                    instance_id: publishedInstance.id,
                    link: "/today-training",
                },
            });
        }
    } catch (e) {
        console.error("[create-instance] Failed to notify student:", e);
    }

    return NextResponse.json<ApiData<CreateInstanceResponseDto>>({
        success: true,
        message: "创建训练计划实例成功",
        data: {
            instance: publishedInstance,
            activationPending,
            activationAfterExecutionId,
        },
    });
}
