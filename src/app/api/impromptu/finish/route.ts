import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { FinishImpromptuDto, FinishImpromptuResponseDto } from "./entity";
import { attachWorkoutEnergyEstimate } from "@/lib/workoutEnergyExecution";
import type { WorkoutEnergyEstimate } from "@/lib/workoutEnergy";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<FinishImpromptuResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json() as FinishImpromptuDto;
        const { executionId, sessionNotes, mode } = body;

        if (!executionId) {
            return NextResponse.json<ApiData<FinishImpromptuResponseDto>>({
                success: false,
                message: "缺少执行ID",
                data: null,
            }, { status: 400 });
        }

        const { data: execution, error: queryError } = await supabase
            .from("impromptu_executions")
            .select("id, student_id, status, action_executions, started_at")
            .eq("id", executionId)
            .single();

        if (queryError || !execution) {
            return NextResponse.json<ApiData<FinishImpromptuResponseDto>>({
                success: false,
                message: "训练记录不存在",
                data: null,
            }, { status: 404 });
        }

        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<FinishImpromptuResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }

        const nowIso = new Date().toISOString();
        const actions = Array.isArray(execution.action_executions)
            ? execution.action_executions
            : [];
        let updatedActions = actions;

        if (mode === "quick") {
            updatedActions = actions.map((action: any) => {
                const sets = Array.isArray(action?.sets) ? action.sets : [];
                const nextSets = sets.map((set: any) => {
                    if (set?.status === "completed") return set;
                    return {
                        ...set,
                        status: "completed",
                        actual_weight: set?.actual_weight ?? null,
                        actual_reps: set?.actual_reps ?? null,
                        completed_at: set?.completed_at ?? nowIso,
                    };
                });
                return {
                    ...action,
                    sets: nextSets,
                    total_sets: nextSets.length,
                    completed_sets: nextSets.filter((set: any) =>
                        set?.status === "completed"
                    ).length,
                };
            });
        }

        const totalSets = updatedActions.reduce(
            (sum: number, action: any) => sum + Number(action?.total_sets || 0),
            0,
        );
        const completedSets = updatedActions.reduce(
            (sum: number, action: any) => sum + Number(action?.completed_sets || 0),
            0,
        );

        let energyEstimate: WorkoutEnergyEstimate | null = null;
        try {
            const energyResult = await attachWorkoutEnergyEstimate({
                db: supabase,
                userId,
                startedAt: execution.started_at,
                completedAt: nowIso,
                actionExecutions: updatedActions,
            });
            energyEstimate = energyResult.estimate;
            if (energyEstimate) updatedActions = energyResult.actionExecutions;
        } catch (energyError) {
            console.warn("[impromptu/finish] calorie estimate skipped:", energyError);
        }

        const { data, error } = await supabase
            .from("impromptu_executions")
            .update({
                status: "completed",
                session_notes: sessionNotes || null,
                completed_at: nowIso,
                action_executions: updatedActions,
                total_sets: totalSets,
                completed_sets: completedSets,
                last_saved_at: nowIso,
            })
            .eq("id", executionId)
            .select("id, status, completed_at, completed_sets, total_sets, action_executions")
            .single();

        if (error || !data) {
            return NextResponse.json<ApiData<FinishImpromptuResponseDto>>({
                success: false,
                message: "完成训练失败",
                data: null,
            }, { status: 500 });
        }

        // 首练达成状态（best-effort）：写入 user_profiles.guides_completed，便于后续引导判断
        try {
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("guides_completed")
                .eq("user_id", userId)
                .maybeSingle();

            const currentGuides = (profile?.guides_completed || {}) as Record<string, any>;
            const updatedGuides = {
                ...currentGuides,
                first_workout_completed: true,
                first_workout_finished_at: nowIso,
            };

            await supabase
                .from("user_profiles")
                .update({
                    guides_completed: updatedGuides,
                    updated_at: nowIso,
                })
                .eq("user_id", userId);
        } catch (profileUpdateError) {
            console.warn("[impromptu/finish] failed to update first workout status:", profileUpdateError);
        }

        return NextResponse.json<ApiData<FinishImpromptuResponseDto>>({
            success: true,
            message: "完成训练成功",
            data: {
                ...data,
                energy_estimate: energyEstimate,
            },
        });
    } catch (error) {
        console.error("finish impromptu error:", error);
        return NextResponse.json<ApiData<FinishImpromptuResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

