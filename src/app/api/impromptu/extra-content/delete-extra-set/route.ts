import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    DeleteImpromptuExtraSetDto,
    DeleteImpromptuExtraSetResponseDto,
} from "../entity";
import { computeExecutionProgress } from "@/lib/executionProgress";
import { detachRemovedSetVideo } from "../../_helpers/removeSetVideo";

export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }
        const body: DeleteImpromptuExtraSetDto = await request.json();
        const { executionId, actionIndex, setIndex } = body;
        if (!executionId || actionIndex === undefined || setIndex === undefined) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
                success: false,
                message: "缺少必填参数",
                data: null,
            }, { status: 400 });
        }

        const { data: execution } = await supabase
            .from("impromptu_executions")
            .select("*")
            .eq("id", executionId)
            .single();
        if (!execution) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }
        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
                success: false,
                message: "无权访问此记录",
                data: null,
            }, { status: 403 });
        }

        if (String(execution.status || "").toLowerCase() !== "in_progress") {
            return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
                success: false,
                message: "训练已结束，不能继续修改动作或组",
                data: null,
            }, { status: 400 });
        }

        const actionExecutions = (execution.action_executions || []) as any[];
        const action = actionExecutions[actionIndex];
        if (!action || !Array.isArray(action.sets) || !action.sets[setIndex]) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
                success: false,
                message: "组不存在",
                data: null,
            }, { status: 400 });
        }
        if (action.sets[setIndex].source !== "student_extra") {
            return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
                success: false,
                message: "只能删除自行添加的组",
                data: null,
            }, { status: 403 });
        }

        // 读法与 mergeImpromptuSetVideos 一致，视频行就是按这个组号挂上去的。
        const removedSet = action.sets[setIndex];
        const removedSetNumber = Number(removedSet.set_number ?? removedSet.setNumber ?? Number(setIndex) + 1);

        action.sets.splice(setIndex, 1);
        action.sets.forEach((set: any, idx: number) => {
            set.set_number = idx + 1;
            set.set_index = idx;
        });
        action.total_sets = action.sets.length;
        const progress = computeExecutionProgress(actionExecutions);

        const setVideos = await detachRemovedSetVideo(executionId, Number(actionIndex), removedSetNumber, userId);
        if (!setVideos) {
            return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        const { error: updateError } = await supabase
            .from("impromptu_executions")
            .update({
                action_executions: actionExecutions,
                total_sets: progress.totalItems,
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId)
            .eq("student_id", userId);
        if (updateError) {
            await setVideos.restore();
            return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
                success: false,
                message: "更新失败",
                data: null,
            }, { status: 500 });
        }

        // 组已删除，这里失败只留下不再展示的残留行，下次删组时会清掉。
        await setVideos.purge();

        return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
            success: true,
            message: "已删除",
            data: {
                executionId,
                actionIndex,
                totalSets: progress.totalItems,
            },
        });
    } catch (error) {
        console.error("delete impromptu extra set error:", error);
        return NextResponse.json<ApiData<DeleteImpromptuExtraSetResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

