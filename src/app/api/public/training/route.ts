import { NextRequest, NextResponse } from "next/server";
import type { PublicTrainingResponseDto } from "../../execution/entity";
import { differenceInMinutes } from "date-fns";
import {
    fetchExecutionByToken,
    getActionSummaries,
    getProfile,
} from "../../execution/share-helper";

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
        const { data: execution, error } = await fetchExecutionByToken(shareToken);

        if (error || !execution) {
            return NextResponse.json<PublicTrainingResponseDto>(
                { success: false, message: "记录不存在或不可见" },
                { status: 404 },
            );
        }

        // 2. 检查可见性 (暂不强制，但在设计上应考虑)
        // if (execution.visibility === 'private') { ... }

        // 3. 计算指标
        const { totalVolume, simplifiedActions } = getActionSummaries(
            execution.action_executions || [],
        );

        const startDate = execution.started_at
            ? new Date(execution.started_at)
            : new Date();
        const completedDate = execution.completed_at
            ? new Date(execution.completed_at)
            : null;
        const durationMinutes = completedDate
            ? differenceInMinutes(completedDate, startDate)
            : 0;

        const profile = await getProfile(execution.student_id);

        return NextResponse.json<PublicTrainingResponseDto>({
            success: true,
            data: {
                executionId: execution.id,
                planName: execution.coach_plan_instances?.name || "未知计划",
                completedAt: execution.completed_at,
                totalVolume: totalVolume,
                totalSets:
                    execution.total_sets ??
                    execution.completed_sets ??
                    simplifiedActions.reduce(
                        (sum: number, item: any) => sum + item.setsCount,
                        0,
                    ),
                durationMinutes: durationMinutes,
                actionExecutions: simplifiedActions,
                user: {
                    nickname: profile?.nickname || "健身达人",
                    avatarUrl: profile?.avatar_url || "",
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
