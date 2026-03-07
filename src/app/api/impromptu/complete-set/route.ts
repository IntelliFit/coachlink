import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CompleteImpromptuSetDto,
    CompleteImpromptuSetResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json() as CompleteImpromptuSetDto;
        const { executionId, actionIndex, setIndex, actualWeight, actualReps, notes } =
            body;

        if (!executionId || actionIndex < 0 || setIndex < 0) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "参数不完整",
                data: null,
            }, { status: 400 });
        }

        const { data: execution, error: queryError } = await supabase
            .from("impromptu_executions")
            .select("id, student_id, status, action_executions")
            .eq("id", executionId)
            .single();

        if (queryError || !execution) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "训练记录不存在",
                data: null,
            }, { status: 404 });
        }

        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }

        if (execution.status === "completed") {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "训练已完成，不能继续修改",
                data: null,
            }, { status: 400 });
        }

        const actions = Array.isArray(execution.action_executions)
            ? execution.action_executions
            : [];
        if (!actions[actionIndex]) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "动作不存在",
                data: null,
            }, { status: 400 });
        }

        const nowIso = new Date().toISOString();
        const nextActions = actions.map((action: any, idx: number) => {
            if (idx !== actionIndex) return action;
            const sets = Array.isArray(action?.sets) ? action.sets : [];
            const nextSets = sets.map((set: any, sIdx: number) => {
                if (sIdx !== setIndex) return set;
                return {
                    ...set,
                    status: "completed",
                    actual_weight: actualWeight ?? set?.actual_weight ?? null,
                    actual_reps: actualReps ?? set?.actual_reps ?? null,
                    notes: notes ?? set?.notes ?? null,
                    completed_at: nowIso,
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

        const totalSets = nextActions.reduce(
            (sum: number, action: any) => sum + Number(action?.total_sets || 0),
            0,
        );
        const completedSets = nextActions.reduce(
            (sum: number, action: any) => sum + Number(action?.completed_sets || 0),
            0,
        );

        const { data: updated, error: updateError } = await supabase
            .from("impromptu_executions")
            .update({
                action_executions: nextActions,
                total_sets: totalSets,
                completed_sets: completedSets,
                last_saved_at: nowIso,
            })
            .eq("id", executionId)
            .select("id, status, action_executions, total_sets, completed_sets")
            .single();

        if (updateError || !updated) {
            return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
                success: false,
                message: "保存失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
            success: true,
            message: "完成组记录成功",
            data: {
                executionId: updated.id,
                completedSets: updated.completed_sets,
                totalSets: updated.total_sets,
                status: updated.status,
                action_executions: updated.action_executions,
            },
        });
    } catch (error) {
        console.error("complete impromptu set error:", error);
        return NextResponse.json<ApiData<CompleteImpromptuSetResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

