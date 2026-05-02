import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { StartImpromptuDto, StartImpromptuResponseDto } from "./entity";

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

        const actionIds = Array.from(
            new Set(
                actions
                    .map((action) => String(action.actionId || "").trim())
                    .filter(Boolean),
            ),
        );

        const actionMetaById = new Map<string, { name: string; type: string | null; attrs: string[] | null }>();
        if (actionIds.length > 0) {
            const { data: actionRows } = await supabase
                .from("student_actions")
                .select("id, name, type, attrs")
                .eq("user_id", userId)
                .in("id", actionIds);

            (actionRows || []).forEach((item: any) => {
                actionMetaById.set(String(item.id), {
                    name: item.name || "",
                    type: item.type || "STRENGTH",
                    attrs: Array.isArray(item.attrs) ? item.attrs : null,
                });
            });
        }

        const actionExecutions = actions.map((action, actionIndex) => {
            const actionId = String(action.actionId || "").trim() || null;
            const actionMeta = actionId ? actionMetaById.get(actionId) : null;
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
                action_id: actionId,
                action_name: action.actionName || `动作${actionIndex + 1}`,
                action_order: actionIndex + 1,
                type: actionMeta?.type || "STRENGTH",
                attrs: actionMeta?.attrs || null,
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

