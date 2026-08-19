import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { UpdateInstanceDto, UpdateInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { syncCoachActionsToStudentLibrary } from "../sync-actions";
import { validateTrainingDaysPresence } from "@/utils/template";
import { toBeijingDateKey } from "@/lib/beijingTime";

function stableJson(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableJson(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
}

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
        .select("coach_id, student_id, coach_subscription_id, training_days, start_date, start_execution_day")
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

    // 获取教练的 user_id（因为 coach_id 是 coaches 表的 id，不是 user_id）
    let coachUserId = null;
    if (existingInstance.coach_id) {
        const { data: coach } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", existingInstance.coach_id)
            .single();
        coachUserId = coach?.user_id;
    }

    // 检查用户权限（只有教练或学员本人可以更新）
    if (coachUserId !== userId && existingInstance.student_id !== userId) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    // Once an execution exists, training_days is the master definition for an
    // immutable execution snapshot. Structural edits must create a new plan
    // instance/revision; updating in place would make the same day_index mean
    // two different workouts and corrupt history displays.
    const trainingDaysChanged = trainingDays !== undefined &&
        stableJson(trainingDays) !== stableJson((existingInstance as any).training_days || []);
    const startDateChanged = startDate !== undefined &&
        (startDate ? toBeijingDateKey(startDate) : null) !==
        (existingInstance.start_date ? String(existingInstance.start_date).slice(0, 10) : null);
    const startExecutionDayChanged = startExecutionDay !== undefined &&
        Number(startExecutionDay) !== Number(existingInstance.start_execution_day || 1);

    if (trainingDaysChanged || startDateChanged || startExecutionDayChanged) {
        const { count: executionCount, error: executionCountError } = await serviceRoleSupabase
            .from("plan_instance_executions")
            .select("id", { count: "exact", head: true })
            .eq("instance_id", id);

        if (executionCountError) {
            console.error("Error checking instance executions:", executionCountError);
            return NextResponse.json({
                success: false,
                message: "Failed to verify execution history",
            }, { status: 500 });
        }

        if (Number(executionCount || 0) > 0) {
            return NextResponse.json({
                success: false,
                code: "PLAN_REVISION_REQUIRED",
                message: "当前计划已有训练记录，训练内容、D1 和接续进度只能通过新版本更新",
            }, { status: 409 });
        }
    }

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

    // 更新计划实例
    const { data: instance, error } = await supabase
        .from("coach_plan_instances")
        .update({
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(executionNotice !== undefined && { execution_notice: executionNotice?.trim() || null }),
            ...(coachId !== undefined && { coach_id: coachId }),
            ...(studentId !== undefined && { student_id: studentId }),
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
