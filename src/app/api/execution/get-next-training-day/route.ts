import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";

// 重要！必须以 import type 引入接口类型
import type {
    GetNextTrainingDayDto,
    GetNextTrainingDayResponseDto,
} from "./entity";

/**
 * POST /api/execution/get-next-training-day
 *
 * 获取学员下一个待执行的训练日
 * 逻辑：
 * 1. 如果计划有 start_execution_day，则该天之前的训练日视为已完成
 * 2. 找到第一个未完成的训练日（跳过休息日）
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        // 重点！通过 session 获取用户 ID
        const userId = session.user.id;

        const {
            instanceId,
        } = await req.json() as GetNextTrainingDayDto;

        if (!instanceId) {
            return NextResponse.json({
                success: false,
                message: "缺少 instanceId 参数",
                data: null,
            }, { status: 400 });
        }

        // 1. 获取计划实例（包含 start_execution_day）
        const { data: instance, error: instanceError } = await supabase
            .from("coach_plan_instances")
            .select("id, training_days, start_execution_day")
            .eq("id", instanceId)
            .single();

        if (instanceError || !instance) {
            return NextResponse.json({
                success: false,
                message: "计划不存在",
                data: null,
            }, { status: 404 });
        }

        // 2. 获取所有已完成的执行记录（包含完成日期）
        const { data: executions } = await supabase
            .from("plan_instance_executions")
            .select("id, day_index, status, completed_at")
            .eq("instance_id", instanceId)
            .eq("status", "completed");

        // 5. 获取起始执行天数（默认为1）
        const startExecutionDay = (instance as any).start_execution_day || 1;

        // 3. 构建完成日期历史 { dayIndex: ISO日期字符串 }
        const completionDates: Record<number, string> = {};
        for (const exec of executions || []) {
            if (exec.completed_at) {
                completionDates[exec.day_index] = exec.completed_at;
            }
        }

        // 4. 检查今天是否已有完成的训练
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayExecution = (executions || []).find((e) => {
            if (!e.completed_at) return false;
            const completedDate = new Date(e.completed_at);
            return completedDate >= today && completedDate < tomorrow;
        });

        const todayCompleted = !!todayExecution;
        const todayExecutionId = todayExecution?.id;

        // 6. 解析训练日
        const getDayIndex = (d: any) => Number(d?.dayIndex ?? d?.day_index ?? 0);
        const trainingDays = (instance.training_days as any[] || [])
            .sort((a, b) => getDayIndex(a) - getDayIndex(b));

        // 7. 找到第一个未完成的训练日（跳过休息日和 start_execution_day 之前的天）
        let nextDayIndex = startExecutionDay; // 从起始执行天开始
        const trainingOnlyDays = trainingDays.filter((d) =>
            d.type === "training" && getDayIndex(d) >= startExecutionDay
        );

        // 提取已完成的 dayIndex 列表（只计入有效范围内的“训练日”，避免 start_execution_day 前的历史影响完成度）
        const trainingOnlyDayIndexSet = new Set(trainingOnlyDays.map((d) => getDayIndex(d)));
        const completedDays = (executions || [])
            .map((e) => e.day_index)
            .filter((di) => di >= startExecutionDay && trainingOnlyDayIndexSet.has(di));

        for (const day of trainingOnlyDays) {
            const di = getDayIndex(day);
            if (!completedDays.includes(di)) {
                nextDayIndex = di;
                break;
            }
        }

        // 如果所有有效训练日都完成了，返回第一个有效训练日（循环）
        if (
            trainingOnlyDays.length > 0 &&
            trainingOnlyDays.every((d) => completedDays.includes(getDayIndex(d)))
        ) {
            nextDayIndex = getDayIndex(trainingOnlyDays[0]);
        }

        // 如果没有任何有效训练日，回退到起始执行天
        if (trainingOnlyDays.length === 0) {
            nextDayIndex = startExecutionDay;
        }

        // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
        return NextResponse.json<ApiData<GetNextTrainingDayResponseDto>>({
            success: true,
            message: "获取成功",
            // GetNextTrainingDayResponseDto 反应的就是这个地方 data 的数据结构
            data: {
                nextDayIndex,
                completedDays,
                totalTrainingDays: trainingOnlyDays.length,
                startExecutionDay: startExecutionDay > 1
                    ? startExecutionDay
                    : undefined,
                todayCompleted,
                todayExecutionId,
                completionDates,
            },
        });
    } catch (error) {
        console.error("获取下一个训练日失败:", error);
        return NextResponse.json({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
