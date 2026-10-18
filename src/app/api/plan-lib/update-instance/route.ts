import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { UpdateInstanceDto, UpdateInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { syncCoachActionsToStudentLibrary } from "../sync-actions";
import { validateTrainingDaysPresence } from "@/utils/template";
import { toBeijingDateKey } from "@/lib/beijingTime";
import { loadPlanEditLock, resolvePlanInstanceAccess } from "@/lib/planInstanceAccess";
import {
    describeLockedPlanDayViolation,
    findLockedPlanDayViolation,
} from "@coachlink/core/src/planEditLock";

export async function POST(req: Request) {
    const {
        id,
        name,
        description,
        executionNotice,
        coachId,
        studentId,
        templateId,
        tags,
        type,
        suitableFor,
        startDate,
        endDate,
        status,
        startExecutionDay,
        trainingDays,
    } = await req.json() as UpdateInstanceDto;

    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!id) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数",
        }, { status: 400 });
    }

    // 首先获取现有的计划实例以检查权限 & 用于校验 start_execution_day
    const { data: existingInstance, error: fetchError } = await supabase
        .from("coach_plan_instances")
        .select("coach_id, student_id, coach_subscription_id, training_days, start_date, start_execution_day, status, source")
        .eq("id", id)
        .single();

    if (fetchError) {
        console.error("Error fetching instance:", fetchError);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch instance",
        }, { status: 500 });
    }

    if (trainingDays !== undefined) {
        const trainingDaysPresence = validateTrainingDaysPresence(trainingDays);
        if (!trainingDaysPresence.valid) {
            return NextResponse.json({
                success: false,
                message: trainingDaysPresence.message,
            }, { status: 400 });
        }
    }

    // 教练计划只允许所属教练修改；学员只能修改自己创建的计划。
    const access = await resolvePlanInstanceAccess({
        client: supabase,
        instance: existingInstance,
        userId,
    });
    if (!access.isCoachOwner && !access.isSelfPlanOwner) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    const changesOwner =
        (coachId !== undefined && (coachId || null) !== (existingInstance.coach_id || null)) ||
        (studentId !== undefined && (studentId || null) !== (existingInstance.student_id || null));
    if (changesOwner) {
        return NextResponse.json({
            success: false,
            message: "不能通过修改计划更换教练或学员",
        }, { status: 400 });
    }

    const currentStatus = String(existingInstance.status || "");
    if (status !== undefined && status !== currentStatus) {
        const pausable = ["active", "paused"];
        if (!pausable.includes(String(status)) || !pausable.includes(currentStatus)) {
            return NextResponse.json({
                success: false,
                message: "计划状态只能在进行中和暂停之间切换；完成、归档或发布请使用对应操作",
            }, { status: 400 });
        }
    }

    // Execution rows contain immutable action snapshots. Updating the current
    // plan definition in place preserves the logical plan id and all workout,
    // video and PR relationships without rewriting historical execution data.

    // Normalize & validate start_execution_day if provided
    let normalizedStartExecutionDay: number | undefined = undefined;
    if (startExecutionDay !== undefined) {
        const n = Number(startExecutionDay);
        if (!Number.isFinite(n) || n < 1) {
            return NextResponse.json({
                success: false,
                message: "startExecutionDay 必须是 >= 1 的数字",
            }, { status: 400 });
        }

        // Determine total days: prefer incoming trainingDays; fallback to existing training_days
        const incomingDays = Array.isArray(trainingDays) ? (trainingDays as any[]) : null;
        const existingDays = Array.isArray((existingInstance as any).training_days)
            ? ((existingInstance as any).training_days as any[])
            : null;
        const totalDays = (incomingDays || existingDays || []).length;
        if (totalDays > 0 && n > totalDays) {
            return NextResponse.json({
                success: false,
                message: `startExecutionDay(${n}) 超出计划总天数(${totalDays})`,
            }, { status: 400 });
        }

        normalizedStartExecutionDay = Math.floor(n);
    }

    // Days up to the furthest workout are history: workout rows only store
    // day_index, so restructuring them would re-attach old workouts to other
    // content, rewind progress and change what is charged.
    if (trainingDays !== undefined || normalizedStartExecutionDay !== undefined) {
        const lock = await loadPlanEditLock({ client: supabase, instanceId: id });
        if (lock.error) {
            return NextResponse.json({
                success: false,
                message: "暂时无法核对训练记录，计划未保存，请稍后重试",
            }, { status: 503 });
        }
        const lockedThroughDayIndex = lock.lockedThroughDayIndex;
        const storedStartExecutionDay = Math.max(1, Number(existingInstance.start_execution_day || 1));
        if (
            lockedThroughDayIndex > 0 &&
            normalizedStartExecutionDay !== undefined &&
            normalizedStartExecutionDay !== storedStartExecutionDay
        ) {
            return NextResponse.json({
                success: false,
                code: "PLAN_START_LOCKED",
                message: "这份计划已有训练记录，不能再修改起始训练日；如需从别的位置开始，请新建阶段。",
            }, { status: 409 });
        }
        const violation = trainingDays !== undefined
            ? findLockedPlanDayViolation({
                savedDays: existingInstance.training_days as any[],
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

    // 更新计划实例
    const { data: instance, error } = await supabase
        .from("coach_plan_instances")
        .update({
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(executionNotice !== undefined && { execution_notice: executionNotice?.trim() || null }),
            ...(templateId !== undefined &&
                { coach_plan_template_id: templateId }),
            ...(startDate !== undefined && {
                start_date: startDate ? toBeijingDateKey(startDate) : null,
            }),
            ...(endDate !== undefined && { end_date: endDate }),
            ...(status !== undefined && { status }),
            ...(type !== undefined && { type }),
            ...(suitableFor !== undefined && { suitable_for: suitableFor }),
            ...(tags !== undefined && { tags }),
            ...(trainingDays !== undefined && { training_days: trainingDays }),
            ...(normalizedStartExecutionDay !== undefined && { start_execution_day: normalizedStartExecutionDay }),
        })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating instance:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to update instance",
        }, { status: 500 });
    }

    // A direct update supersedes any temporary pending payload left by an
    // older client. Never let that payload later replace the current instance.
    await serviceRoleSupabase
        .from("coach_plan_instances")
        .update({
            status: "archived",
            archive_reason: "superseded_pending_update",
            entitlement_consumption_policy: "no_charge",
            activation_after_execution_id: null,
            activation_reason: null,
            updated_at: new Date().toISOString(),
        })
        .eq("revision_of_instance_id", id)
        .eq("status", "scheduled");

    // 如果更新了 trainingDays，同步动作到学员库
    if (trainingDays !== undefined && Array.isArray(trainingDays)) {
        try {
            // 获取学员ID：优先使用 existingInstance.student_id，否则从订阅中获取
            let studentId = existingInstance.student_id as string | null;
            if (!studentId && existingInstance.coach_subscription_id) {
                const { data: subscription } = await supabase
                    .from("coach_subscriptions")
                    .select("student_id")
                    .eq("id", existingInstance.coach_subscription_id)
                    .single();
                studentId = subscription?.student_id as string | null;
            }

            if (studentId) {
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
            // best-effort; do not block instance update
            console.warn("[update-instance] Failed to sync actions to student library:", e);
        }
    }

    return NextResponse.json<ApiData<UpdateInstanceResponseDto>>({
        success: true,
        message: "更新训练计划实例成功",
        data: {
            instance,
        },
    });
}
