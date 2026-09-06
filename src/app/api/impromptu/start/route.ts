import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { StartImpromptuDto, StartImpromptuResponseDto } from "./entity";
import { attachImpromptuSetVideos } from "../_helpers/setVideoUpload";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<StartImpromptuResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json() as StartImpromptuDto;
        const actions = Array.isArray(body.actions) ? body.actions : [];

        if (actions.length === 0) {
            return NextResponse.json<ApiData<StartImpromptuResponseDto>>({
                success: false,
                message: "请至少选择一个动作",
                data: null,
            }, { status: 400 });
        }

        const { data: currentExecution, error: currentError } = await supabase
            .from("impromptu_executions")
            .select("*")
            .eq("student_id", userId)
            .eq("status", "in_progress")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (currentError) {
            console.error("find current impromptu execution error:", currentError);
            return NextResponse.json<ApiData<StartImpromptuResponseDto>>({
                success: false,
                message: "查询进行中的即兴训练失败",
                data: null,
            }, { status: 500 });
        }

        if (currentExecution) {
            const hydrated = await attachImpromptuSetVideos(currentExecution as any);
            return NextResponse.json<ApiData<StartImpromptuResponseDto>>({
                success: true,
                message: "继续未完成的即兴训练",
                data: hydrated,
            });
        }

        const actionExecutions = actions.map((action, actionIndex) => {
            const itemType = String(action.itemType || "STRENGTH").toUpperCase() === "CARDIO"
                ? "CARDIO"
                : "STRENGTH";
            const totalSets = Math.max(1, Number(action.sets || 1));
            const plannedReps = action.reps === null || action.reps === undefined
                ? null
                : String(action.reps);
            const plannedWeight = action.weight === null || action.weight === undefined || action.weight === ""
                ? null
                : String(action.weight);
            const plannedRestSeconds = action.restSeconds && action.restSeconds > 0
                ? action.restSeconds
                : 90;

            return {
                action_id: action.actionId || null,
                action_name: action.actionName || `动作${actionIndex + 1}`,
                action_order: actionIndex + 1,
                type: itemType,
                item_type: itemType,
                attrs: Array.isArray(action.attrs) ? action.attrs : null,
                category: action.category || null,
                item_schema: action.itemSchema || null,
                suggested_time: action.suggestedTime || null,
                sets: Array.from({ length: totalSets }, (_, setIndex) => ({
                    set_number: setIndex + 1,
                    status: "pending",
                    planned_reps: plannedReps,
                    planned_weight: plannedWeight,
                    planned_rest_seconds: plannedRestSeconds,
                    actual_reps: null,
                    actual_weight: null,
                    has_video: false,
                    is_pr: false,
                })),
                total_sets: totalSets,
                completed_sets: 0,
            };
        });

        const totalSets = actionExecutions.reduce(
            (sum: number, item: any) => sum + Number(item.total_sets || 0),
            0,
        );

        const { data, error } = await supabase
            .from("impromptu_executions")
            .insert({
                student_id: userId,
                status: "in_progress",
                action_executions: actionExecutions,
                total_sets: totalSets,
                completed_sets: 0,
            })
            .select("*")
            .single();

        if (error || !data) {
            return NextResponse.json<ApiData<StartImpromptuResponseDto>>({
                success: false,
                message: "创建即兴训练失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StartImpromptuResponseDto>>({
            success: true,
            message: "开始即兴训练成功",
            data,
        });
    } catch (error) {
        console.error("start impromptu error:", error);
        return NextResponse.json<ApiData<StartImpromptuResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

