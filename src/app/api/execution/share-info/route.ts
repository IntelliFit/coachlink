import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { ShareInfoResponseDto } from "../entity";
import {
    differenceInMinutes,
    endOfMonth,
    format,
    startOfMonth,
} from "date-fns";

/**
 * GET /api/execution/share-info?id={executionId}
 *
 * 获取训练打卡卡片所需的数据
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<ShareInfoResponseDto>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const { searchParams } = new URL(request.url);
        const executionId = searchParams.get("id");

        if (!executionId) {
            return NextResponse.json<ShareInfoResponseDto>(
                { success: false, message: "缺少执行ID" },
                { status: 400 },
            );
        }

        // 1. 获取执行记录及其关联的计划名称和用户信息
        // 使用 type cast 解决 Supabase 复杂的类型推断问题
        const { data: execution, error } = await supabase
            .from("plan_instance_executions")
            .select(`
                *,
                user_profiles:student_id (nickname, avatar_url),
                coach_plan_instances:instance_id (name)
            `)
            .eq("id", executionId)
            .single() as any;

        if (error || !execution) {
            return NextResponse.json<ShareInfoResponseDto>(
                { success: false, message: "记录不存在" },
                { status: 404 },
            );
        }

        // 验证权限（只能分享自己的记录）
        if (execution.student_id !== userId) {
            return NextResponse.json<ShareInfoResponseDto>(
                { success: false, message: "无权限" },
                { status: 403 },
            );
        }

        // 2. 计算训练指标
        let totalVolume = 0;
        const prRecords: any[] = [];

        if (
            execution.action_executions &&
            Array.isArray(execution.action_executions)
        ) {
            execution.action_executions.forEach((action: any) => {
                if (action.sets && Array.isArray(action.sets)) {
                    action.sets.forEach((set: any) => {
                        if (set.status === "completed" || set.completed_at) {
                            const weight = set.actual_weight || 0;
                            const reps = set.actual_reps || 0;
                            totalVolume += weight * reps;

                            if (set.is_pr) {
                                prRecords.push({
                                    exerciseName: action.action_name,
                                    weight: weight,
                                    reps: reps,
                                });
                            }
                        }
                    });
                }
            });
        }

        const startDate = new Date(execution.started_at);
        const completedDate = execution.completed_at
            ? new Date(execution.completed_at)
            : null;
        const durationMinutes = completedDate
            ? differenceInMinutes(completedDate, startDate)
            : 0;

        // 3. 获取当月训练天数（用于热力图）
        const monthStart = startOfMonth(startDate).toISOString();
        const monthEnd = endOfMonth(startDate).toISOString();

        const { data: monthlyExecutions } = await supabase
            .from("plan_instance_executions")
            .select("started_at")
            .eq("student_id", userId)
            .eq("status", "completed")
            .gte("started_at", monthStart)
            .lte("started_at", monthEnd);

        const monthlyTrainingDays = Array.from(
            new Set(
                (monthlyExecutions || []).map((ex) =>
                    format(new Date(ex.started_at), "yyyy-MM-dd")
                ),
            ),
        );

        // 4. 解析计划名称
        const planName = execution.coach_plan_instances?.name || "未知计划";

        return NextResponse.json<ShareInfoResponseDto>({
            success: true,
            data: {
                executionId: execution.id,
                shareToken: execution.share_token,
                dayIndex: execution.day_index || execution.dayIndex, // 兼容旧字段名
                planName: planName,
                completedAt: execution.completed_at,
                totalVolume: totalVolume,
                totalSets: execution.completed_sets,
                durationMinutes: durationMinutes,
                prRecords: prRecords,
                monthlyTrainingDays: monthlyTrainingDays,
                user: {
                    nickname: execution.user_profiles?.nickname || "健身达人",
                    avatarUrl: execution.user_profiles?.avatar_url || "",
                },
            },
        });
    } catch (error) {
        console.error("获取分享信息失败:", error);
        return NextResponse.json<ShareInfoResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
