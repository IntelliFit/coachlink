import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";

interface GetNextTrainingDayResponse {
    nextDayIndex: number;
    completedDays: number[];
    totalTrainingDays: number;
    startExecutionDay?: number;
}

/**
 * GET /api/execution/get-next-training-day
 *
 * 获取学员下一个待执行的训练日
 * 逻辑：
 * 1. 如果计划有 start_execution_day，则该天之前的训练日视为已完成
 * 2. 找到第一个未完成的训练日（跳过休息日）
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "未登录", data: null },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(req.url);
        const instanceId = searchParams.get("instanceId");

        if (!instanceId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 instanceId 参数", data: null },
                { status: 400 },
            );
        }

        // 1. 获取计划实例（包含 start_execution_day）
        const { data: instance, error: instanceError } = await supabase
            .from("coach_plan_instances")
            .select("id, training_days, start_execution_day")
            .eq("id", instanceId)
            .single();

        if (instanceError || !instance) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "计划不存在", data: null },
                { status: 404 },
            );
        }

        // 2. 获取所有已完成的执行记录
        const { data: executions } = await supabase
            .from("plan_instance_executions")
            .select("day_index, status")
            .eq("instance_id", instanceId)
            .eq("status", "completed");

        // 提取已完成的 dayIndex 列表
        const completedDays = (executions || []).map((e) => e.day_index);

        // 3. 获取起始执行天数（默认为1）
        const startExecutionDay = (instance as any).start_execution_day || 1;

        // 4. 解析训练日
        const trainingDays = (instance.training_days as any[] || [])
            .sort((a, b) => a.dayIndex - b.dayIndex);

        // 5. 找到第一个未完成的训练日（跳过休息日和 start_execution_day 之前的天）
        let nextDayIndex = startExecutionDay; // 从起始执行天开始
        const trainingOnlyDays = trainingDays.filter((d) =>
            d.type === "training" && d.dayIndex >= startExecutionDay
        );

        for (const day of trainingOnlyDays) {
            if (!completedDays.includes(day.dayIndex)) {
                nextDayIndex = day.dayIndex;
                break;
            }
        }

        // 如果所有有效训练日都完成了，返回第一个有效训练日（循环）
        if (
            trainingOnlyDays.length > 0 &&
            trainingOnlyDays.every((d) => completedDays.includes(d.dayIndex))
        ) {
            nextDayIndex = trainingOnlyDays[0].dayIndex;
        }

        // 如果没有任何有效训练日，回退到起始执行天
        if (trainingOnlyDays.length === 0) {
            nextDayIndex = startExecutionDay;
        }

        return NextResponse.json<ApiData<GetNextTrainingDayResponse>>({
            success: true,
            message: "获取成功",
            data: {
                nextDayIndex,
                completedDays,
                totalTrainingDays: trainingOnlyDays.length,
                startExecutionDay: startExecutionDay > 1
                    ? startExecutionDay
                    : undefined,
            },
        });
    } catch (error) {
        console.error("获取下一个训练日失败:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}
