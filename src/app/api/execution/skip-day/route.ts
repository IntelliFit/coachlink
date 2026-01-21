import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { ApiData } from "@/types/api";

// Minimal "skip" endpoint (spec v1):
// - Mark a training day as abandoned (treated as "skipped" for progress pointer)
// - Does NOT count as completed (so it won't consume credits)
export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;
    if (!userId) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const instanceId = String(body?.instanceId || "");
    const dayIndex = Number(body?.dayIndex || 0);

    if (!instanceId || !dayIndex || dayIndex < 1) {
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
    if (!hasPermission && session.user.is_coach && instance.coach_id) {
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

    const startExecutionDay = Number((instance as any).start_execution_day || 1);
    if (dayIndex < startExecutionDay) {
        return NextResponse.json({ success: false, message: "Cannot skip offline-completed days" }, { status: 400 });
    }

    const trainingDays = Array.isArray((instance as any).training_days) ? ((instance as any).training_days as any[]) : [];
    const isTrainingDay = trainingDays.some((d) => Number(d?.dayIndex ?? d?.day_index) === dayIndex && d?.type === "training");
    if (!isTrainingDay) {
        return NextResponse.json({ success: false, message: "Only training days can be skipped" }, { status: 400 });
    }

    // If there's any existing execution for that day, update the latest one; else create a minimal record.
    const { data: existing } = await supabase
        .from("plan_instance_executions")
        .select("id, started_at")
        .eq("instance_id", instanceId)
        .eq("student_id", instance.student_id)
        .eq("day_index", dayIndex)
        .order("started_at", { ascending: false })
        .limit(1);

    if (existing && existing.length > 0) {
        const { error: updErr } = await supabase
            .from("plan_instance_executions")
            .update({
                status: "abandoned",
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", existing[0].id);

        if (updErr) {
            return NextResponse.json({ success: false, message: "Failed to update execution" }, { status: 500 });
        }
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

    return NextResponse.json<ApiData<any>>({
        success: true,
        message: "已标记跳过",
        data: { instanceId, dayIndex },
    });
}

