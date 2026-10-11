import { executionHasRecordedProgress } from '@coachlink/core/src/executionCancellation';
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { activatePendingPlanRevisionForSource } from "@/lib/planExecutionLifecycle";

const db = serviceRoleSupabase as any;

/**
 * POST /api/execution/cancel
 *
 * Delete an accidentally opened, still-empty plan execution so the plan day
 * returns to its pre-start state. Completed or partially recorded workouts are
 * deliberately protected from deletion.
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = await getAuthUser(request);
        if (!authResult.isAuthenticated || !authResult.userId) {
            return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const executionId = String(body?.executionId || "").trim();
        if (!executionId) {
            return NextResponse.json({ success: false, message: "缺少执行记录 ID" }, { status: 400 });
        }

        const { data: execution, error: executionError } = await db
            .from("plan_instance_executions")
            .select("id, instance_id, student_id, day_index, status, completed_sets, action_executions, session_notes, updated_at")
            .eq("id", executionId)
            .maybeSingle();

        if (executionError) {
            console.error("[execution/cancel] load execution failed", executionError);
            return NextResponse.json({ success: false, message: "读取训练记录失败" }, { status: 500 });
        }
        if (!execution) {
            return NextResponse.json({ success: false, message: "训练记录不存在或已取消" }, { status: 404 });
        }

        let hasPermission = execution.student_id === authResult.userId;
        if (!hasPermission) {
            const { data: instance, error: instanceError } = await db
                .from("coach_plan_instances")
                .select("coach_id")
                .eq("id", execution.instance_id)
                .maybeSingle();
            if (instanceError) {
                console.error("[execution/cancel] load instance failed", instanceError);
                return NextResponse.json({ success: false, message: "读取计划失败" }, { status: 500 });
            }
            if (instance?.coach_id) {
                const { data: coach } = await db
                    .from("coaches")
                    .select("id")
                    .eq("id", instance.coach_id)
                    .eq("user_id", authResult.userId)
                    .maybeSingle();
                hasPermission = !!coach;
            }
        }

        if (!hasPermission) {
            return NextResponse.json({ success: false, message: "无权取消这次训练" }, { status: 403 });
        }

        if (String(execution.status || "").toLowerCase() !== "in_progress") {
            return NextResponse.json({
                success: false,
                message: "只有尚在进行中的训练可以取消",
            }, { status: 409 });
        }

        if (executionHasRecordedProgress(execution)) {
            return NextResponse.json({
                success: false,
                message: "本次训练已有完成内容，不能直接取消，请联系教练处理",
            }, { status: 409 });
        }

        const dependencyQueries = [
            db.from("execution_set_videos").select("id", { count: "exact", head: true }).eq("execution_id", executionId),
            db.from("execution_feedbacks").select("id", { count: "exact", head: true }).eq("execution_id", executionId),
            db.from("personal_records_history").select("id", { count: "exact", head: true }).eq("execution_id", executionId),
        ];
        const dependencyResults = await Promise.all(dependencyQueries);
        const dependencyError = dependencyResults.find((result: any) => result.error)?.error;
        if (dependencyError) {
            console.error("[execution/cancel] dependency check failed", dependencyError);
            return NextResponse.json({ success: false, message: "检查训练关联数据失败" }, { status: 500 });
        }
        if (dependencyResults.some((result: any) => Number(result.count || 0) > 0)) {
            return NextResponse.json({
                success: false,
                message: "本次训练已有视频、反馈或纪录，不能直接取消",
            }, { status: 409 });
        }

        // Optimistic locking protects against deleting a row that changed
        // between the safety checks above and this delete.
        const { data: deleted, error: deleteError } = await db
            .from("plan_instance_executions")
            .delete()
            .eq("id", execution.id)
            .eq("status", "in_progress")
            .eq("completed_sets", 0)
            .eq("updated_at", execution.updated_at)
            .select("id")
            .maybeSingle();

        if (deleteError) {
            console.error("[execution/cancel] delete failed", deleteError);
            return NextResponse.json({ success: false, message: "取消训练失败" }, { status: 500 });
        }
        if (!deleted) {
            return NextResponse.json({
                success: false,
                message: "训练记录刚刚发生变化，请刷新后重试",
            }, { status: 409 });
        }

        try {
            await activatePendingPlanRevisionForSource({
                sourceInstanceId: execution.instance_id,
            });
        } catch (activationError) {
            console.error("[execution/cancel] pending revision activation failed", activationError);
        }

        return NextResponse.json({
            success: true,
            message: "本次训练已取消",
            data: {
                executionId: execution.id,
                instanceId: execution.instance_id,
                dayIndex: execution.day_index,
            },
        });
    } catch (error) {
        console.error("[execution/cancel] unexpected error", error);
        return NextResponse.json({ success: false, message: "服务器错误" }, { status: 500 });
    }
}
