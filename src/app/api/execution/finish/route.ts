import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { FinishTrainingDto, FinishTrainingResponseDto } from "./entity";
import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";
import { computeExecutionProgress } from "@/lib/executionProgress";

const parseMinNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const match = String(value).match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : null;
};

const parseMinReps = (value: unknown): number | null => {
    const num = parseMinNumber(value);
    if (num === null) return null;
    return Math.max(0, Math.floor(num));
};

const parseMinWeight = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const raw = String(value).toLowerCase();
    if (!raw) return null;
    if (raw.includes("rm") || raw.includes("%") || raw.includes("rpe")) return null;
    return parseMinNumber(raw);
};

/**
 * POST /api/execution/finish
 *
 * 完成训练
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body: FinishTrainingDto = await request.json();
        const { executionId, sessionNotes, mode } = body;

        if (!executionId) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "缺少执行ID",
                data: null,
            }, { status: 400 });
        }

        // 验证权限并获取 instance_id
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select("student_id, completed_sets, total_sets, instance_id, action_executions")
            .eq("id", executionId)
            .single();

        if (!execution || execution.student_id !== userId) {
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }

        const nowIso = new Date().toISOString();
        const updatePayload: Record<string, unknown> = {
            status: "completed",
            completed_at: nowIso,
            session_notes: sessionNotes || null,
        };

        if (mode === "quick") {
            const rawActions = execution.action_executions;
            let actions: any[] = [];
            if (Array.isArray(rawActions)) {
                actions = rawActions;
            } else if (typeof rawActions === "string") {
                try {
                    const parsed = JSON.parse(rawActions);
                    actions = Array.isArray(parsed) ? parsed : [];
                } catch {
                    actions = [];
                }
            }

            const completedAt = nowIso;
            const updatedActions = actions.map((action) => {
                const sets = Array.isArray(action?.sets) ? action.sets : null;
                if (sets) {
                    const nextSets = sets.map((set: any) => {
                        const alreadyCompleted = set?.status === "completed";
                        if (alreadyCompleted) {
                            return set;
                        }
                        const defaultWeight = parseMinWeight(set?.planned_weight);
                        const defaultReps = parseMinReps(set?.planned_reps);
                        return {
                            ...set,
                            status: "completed",
                            actual_weight: set?.actual_weight ?? defaultWeight ?? null,
                            actual_reps: set?.actual_reps ?? defaultReps ?? null,
                            completed_at: set?.completed_at ?? completedAt,
                        };
                    });
                    return {
                        ...action,
                        sets: nextSets,
                        total_sets: nextSets.length,
                        completed_sets: nextSets.filter((s: any) => s?.status === "completed").length,
                    };
                }

                return {
                    ...action,
                    status: "completed",
                    completed: true,
                    completed_at: action?.completed_at ?? completedAt,
                };
            });

            const progress = computeExecutionProgress(updatedActions);
            updatePayload.action_executions = updatedActions;
            updatePayload.completed_sets = progress.completedItems;
            updatePayload.total_sets = progress.totalItems;
            updatePayload.last_saved_at = nowIso;
        }

        // 更新状态
        const { data, error } = await supabase
            .from("plan_instance_executions")
            .update(updatePayload)
            .eq("id", executionId)
            .select()
            .single();

        if (error) {
            console.error("完成训练失败:", error);
            return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        // 异步更新订阅的预计完成日期
        if (execution.instance_id) {
            updateEstimatedEndDateForInstance(execution.instance_id);
        }

        return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
            success: true,
            message: "完成训练成功",
            data: {
                id: data.id,
                status: data.status,
                completed_at: data.completed_at,
                completed_sets: data.completed_sets,
                total_sets: data.total_sets,
            },
        });
    } catch (error) {
        console.error("完成训练失败:", error);
        return NextResponse.json<ApiData<FinishTrainingResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
