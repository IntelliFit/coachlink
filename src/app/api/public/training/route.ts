import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import type { PublicTrainingResponseDto } from "../../execution/entity";
import { differenceInMinutes, format } from "date-fns";

/**
 * GET /api/public/training?token={shareToken}
 *
 * 公开访问：通过 shareToken 获取训练摘要（用于分享详情页，无需登录）
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const shareToken = searchParams.get("token");

        if (!shareToken) {
            return NextResponse.json<PublicTrainingResponseDto>(
                { success: false, message: "缺少分享Token" },
                { status: 400 },
            );
        }

        // 1. 获取执行记录及其关联信息
        const { data: execution, error } = await supabase
            .from("plan_instance_executions")
            .select(`
                *,
                user_profiles:student_id (nickname, avatar_url),
                coach_plan_instances:instance_id (name)
            `)
            .eq("share_token", shareToken)
            .single() as any;

        if (error || !execution) {
            return NextResponse.json<PublicTrainingResponseDto>(
                { success: false, message: "记录不存在或不可见" },
                { status: 404 },
            );
        }

        // 2. 检查可见性 (暂不强制，但在设计上应考虑)
        // if (execution.visibility === 'private') { ... }

        // 3. 计算指标
        let totalVolume = 0;
        const simplifiedActions = (execution.action_executions || []).map(
            (action: any) => {
                let actionSetsCount = 0;
                let actionVolume = 0;

                if (action.sets && Array.isArray(action.sets)) {
                    action.sets.forEach((set: any) => {
                        if (set.status === "completed" || set.completed_at) {
                            actionSetsCount++;
                            const weight = set.actual_weight || 0;
                            const reps = set.actual_reps || 0;
                            actionVolume += weight * reps;
                            totalVolume += weight * reps;
                        }
                    });
                }

                return {
                    actionName: action.action_name,
                    setsCount: actionSetsCount,
                    volume: actionVolume,
                };
            },
        );

        const startDate = new Date(execution.started_at);
        const completedDate = execution.completed_at
            ? new Date(execution.completed_at)
            : null;
        const durationMinutes = completedDate
            ? differenceInMinutes(completedDate, startDate)
            : 0;

        return NextResponse.json<PublicTrainingResponseDto>({
            success: true,
            data: {
                executionId: execution.id,
                planName: execution.coach_plan_instances?.name || "未知计划",
                completedAt: execution.completed_at,
                totalVolume: totalVolume,
                totalSets: execution.completed_sets,
                durationMinutes: durationMinutes,
                actionExecutions: simplifiedActions,
                user: {
                    nickname: execution.user_profiles?.nickname || "健身达人",
                    avatarUrl: execution.user_profiles?.avatar_url || "",
                },
            },
        });
    } catch (error) {
        console.error("公开获取训练信息失败:", error);
        return NextResponse.json<PublicTrainingResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
