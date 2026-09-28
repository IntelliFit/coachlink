import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getApiUserId } from "@/lib/getApiUserId";
import { ApiData } from "@/types/api";
import { filterTrainingDaysByAccessWindow } from "@/lib/subscriptionAccess";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";
import { activatePendingPlanRevisionForSource } from "@/lib/planExecutionLifecycle";
import { updateExecutionIfUnchanged, EXECUTION_WRITE_CONFLICT } from '../_helpers/conditionalUpdate';

// Minimal "skip" endpoint (spec v1):
// - Mark a training day as abandoned (treated as "skipped" for progress pointer)
// - Does NOT count as completed (so it won't consume credits)
export async function POST(req: Request) {
    const userId = await getApiUserId(req);
    if (!userId) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const instanceId = String(body?.instanceId || "");
    const dayIndex = Number(body?.dayIndex || 0);

    if (!instanceId || !Number.isInteger(dayIndex) || dayIndex < 1) {
        return NextResponse.json({ success: false, message: "Invalid parameters" }, { status: 400 });
    }

    // Permission: must be the student of this instance (or the owning coach)
    const { data: instance, error: instErr } = await supabase
        .from("coach_plan_instances")
        .select("id, student_id, coach_id, start_execution_day, training_days")
        .eq("id", instanceId)
        .maybeSingle();

    if (instErr || !instance) {
        return NextResponse.json({ success: false, message: "Instance not found" }, { status: 404 });
    }

    let hasPermission = false;
    if (instance.student_id && instance.student_id === userId) hasPermission = true;
    if (!hasPermission && instance.coach_id) {
        const { data: coach } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", instance.coach_id)
            .maybeSingle();
        if (coach?.user_id === userId) hasPermission = true;
    }

    if (!hasPermission) {
        return NextResponse.json({ success: false, message: "权限不足" }, { status: 403 });
    }

    const isStudentOwner = instance.student_id && instance.student_id === userId;
    let maxAccessibleDayIndex: number | null = null;
    if (isStudentOwner) {
        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId,
            studentId: userId,
            dayIndex,
        });
        if (!accessDecision.allowed) {
            return NextResponse.json(
                { success: false, message: accessDecision.message || "无权访问此计划" },
                { status: accessDecision.status },
            );
        }
        maxAccessibleDayIndex = accessDecision.maxAccessibleDayIndex;
    }

    const startExecutionDay = Number((instance as any).start_execution_day || 1);
    if (dayIndex < startExecutionDay) {
        return NextResponse.json({ success: false, message: "Cannot skip offline-completed days" }, { status: 400 });
    }

    const trainingDays = filterTrainingDaysByAccessWindow(
        Array.isArray((instance as any).training_days)
            ? ((instance as any).training_days as any[])
            : [],
        maxAccessibleDayIndex,
    );
    const isTrainingDay = trainingDays.some((d) => Number(d?.dayIndex ?? d?.day_index) === dayIndex && d?.type === "training");
    if (!isTrainingDay) {
        return NextResponse.json({ success: false, message: "Only training days can be skipped" }, { status: 400 });
    }

    // A newer empty attempt is not allowed to erase an earlier completion.
    // Read every attempt before choosing the editable row.
    const { data: existing, error: historyError } = await supabase
        .from("plan_instance_executions")
        .select("id, student_id, status, updated_at, started_at, close_reason")
        .eq("instance_id", instanceId)
        .eq("student_id", instance.student_id)
        .eq("day_index", dayIndex)
        .order("started_at", { ascending: false });

    if (historyError) {
        return NextResponse.json({ success: false, message: '暂时无法核对训练记录，请稍后重试' }, { status: 503 });
    }
    if (existing?.some(row => row.status === 'completed')) {
        return NextResponse.json({ success: false, message: '这一天已经完成，不能再标记跳过' }, { status: 409 });
    }
    if (existing?.some(row => row.status === 'abandoned' && row.close_reason !== 'superseded_by_late_completion')) {
        return NextResponse.json({ success: true, message: '这一天已跳过', data: { instanceId, dayIndex } });
    }

    if (existing && existing.length > 0) {
        const target = existing[0];
        if (!target.updated_at || !['in_progress', 'timed_out'].includes(target.status)) {
            return NextResponse.json(EXECUTION_WRITE_CONFLICT, { status: 409 });
        }
        const { data: updated, error: updErr } = await updateExecutionIfUnchanged({
            client: supabase,
            execution: target,
            patch: {
                status: "abandoned",
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
        });

        if (updErr) {
            return NextResponse.json({ success: false, message: "Failed to update execution" }, { status: 500 });
        }
        if (!updated) return NextResponse.json(EXECUTION_WRITE_CONFLICT, { status: 409 });
    } else {
        const nowIso = new Date().toISOString();
        const { error: insErr } = await supabase
            .from("plan_instance_executions")
            .insert({
                instance_id: instanceId,
                student_id: instance.student_id,
                day_index: dayIndex,
                status: "abandoned",
                started_at: nowIso,
                completed_at: nowIso,
                action_executions: [],
                total_sets: 0,
                completed_sets: 0,
                last_saved_at: nowIso,
            });

        if (insErr) {
            return NextResponse.json({ success: false, message: "Failed to create execution" }, { status: 500 });
        }
    }

    try {
        await activatePendingPlanRevisionForSource({ sourceInstanceId: instanceId });
    } catch (activationError) {
        console.error("[execution/skip-day] pending revision activation failed:", activationError);
    }

    return NextResponse.json<ApiData<any>>({
        success: true,
        message: "已标记跳过",
        data: { instanceId, dayIndex },
    });
}

