import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";

interface GetNextTrainingDayResponse {
    nextDayIndex: number;
    completedDays: number[];
    totalTrainingDays: number;
}

/**
 * GET /api/execution/get-next-training-day
 *
 * 获取学员下一个待执行的训练日
 * 逻辑：找到第一个未完成的训练日（跳过休息日）
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

        // 1. 获取计划实例
        const { data: instance, error: instanceError } = await supabase
            .from("coach_plan_instances")
            .select("id, training_days")
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

        // 3. 解析训练日
        const trainingDays = (instance.training_days as any[] || [])
            .sort((a, b) => a.dayIndex - b.dayIndex);

        // 4. 找到第一个未完成的训练日（跳过休息日）
        let nextDayIndex = 1;
        const trainingOnlyDays = trainingDays.filter((d) =>
            d.type === "training"
        );

        for (const day of trainingOnlyDays) {
            if (!completedDays.includes(day.dayIndex)) {
                nextDayIndex = day.dayIndex;
                break;
            }
        }

        // 如果所有训练日都完成了，返回第一个训练日（循环）
        if (
            trainingOnlyDays.length > 0 &&
            trainingOnlyDays.every((d) => completedDays.includes(d.dayIndex))
        ) {
            nextDayIndex = trainingOnlyDays[0].dayIndex;
        }

        return NextResponse.json<ApiData<GetNextTrainingDayResponse>>({
            success: true,
            message: "获取成功",
            data: {
                nextDayIndex,
                completedDays,
                totalTrainingDays: trainingOnlyDays.length,
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
