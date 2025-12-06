import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { CompleteSetDto, CompleteSetResponseDto } from "../entity";

/**
 * POST /api/execution/complete-set
 *
 * 完成一组训练
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<CompleteSetResponseDto>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        // 2. 解析请求参数
        const body: CompleteSetDto = await request.json();
        const {
            executionId,
            actionIndex,
            setIndex,
            actionId,
            actualWeight,
            actualReps,
            rpe,
            notes,
            is_pr,
            has_video,
        } = body;

        if (
            !executionId || actionIndex === undefined || setIndex === undefined
        ) {
            return NextResponse.json<CompleteSetResponseDto>(
                { success: false, message: "缺少必填参数" },
                { status: 400 },
            );
        }

        // 3. 获取执行记录
        const { data: execution, error: fetchError } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("id", executionId)
            .single();

        if (fetchError || !execution) {
            return NextResponse.json<CompleteSetResponseDto>(
                { success: false, message: "执行记录不存在" },
                { status: 404 },
            );
        }

        // 4. 验证权限
        if (execution.student_id !== userId) {
            return NextResponse.json<CompleteSetResponseDto>(
                { success: false, message: "无权访问此记录" },
                { status: 403 },
            );
        }

        // 4.5 查询视频URL（如果has_video为true）
        let video_url: string | null = null;
        console.log("[complete-set] Input:", {
            actionId,
            has_video,
            is_pr,
            setIndex,
        });

        if (has_video && actionId) {
            const { data: videoRecord, error: videoError } = await supabase
                .from("execution_set_videos")
                .select("video_url")
                .eq("execution_id", executionId)
                .eq("action_id", actionId)
                .eq("set_number", setIndex + 1)
                .maybeSingle();

            console.log("[complete-set] Video query:", {
                executionId,
                actionId,
                setNumber: setIndex + 1,
                videoRecord,
                videoError,
            });

            if (videoRecord) {
                video_url = videoRecord.video_url;
            }
        }

        console.log("[complete-set] Will save:", {
            is_pr,
            has_video,
            video_url,
        });

        // 5. 更新 JSONB 数据
        const actionExecutions = execution.action_executions as any[];

        if (
            !actionExecutions[actionIndex] ||
            !actionExecutions[actionIndex].sets[setIndex]
        ) {
            return NextResponse.json<CompleteSetResponseDto>(
                { success: false, message: "组不存在" },
                { status: 400 },
            );
        }

        // 更新组数据 - 包含is_pr, has_video, video_url
        actionExecutions[actionIndex].sets[setIndex] = {
            ...actionExecutions[actionIndex].sets[setIndex],
            status: "completed",
            actual_weight: actualWeight,
            actual_reps: actualReps,
            rpe,
            notes: notes || "",
            is_pr: is_pr || false,
            has_video: has_video || false,
            video_url: video_url,
            completed_at: new Date().toISOString(),
        };

        // 更新动作已完成组数
        actionExecutions[actionIndex].completed_sets =
            actionExecutions[actionIndex].sets.filter(
                (s: any) => s.status === "completed",
            ).length;

        // 计算总完成组数
        const totalCompletedSets = actionExecutions.reduce(
            (sum, action) => sum + (action.completed_sets || 0),
            0,
        );

        // 6. 保存到数据库
        const { error: updateError } = await supabase
            .from("plan_instance_executions")
            .update({
                action_executions: actionExecutions,
                completed_sets: totalCompletedSets,
                last_saved_at: new Date().toISOString(),
            })
            .eq("id", executionId);

        if (updateError) {
            console.error("更新失败:", updateError);
            return NextResponse.json<CompleteSetResponseDto>(
                { success: false, message: "更新失败" },
                { status: 500 },
            );
        }

        return NextResponse.json<CompleteSetResponseDto>({
            success: true,
            data: {
                executionId,
                completedSets: totalCompletedSets,
                totalSets: execution.total_sets,
            },
        });
    } catch (error) {
        console.error("完成组失败:", error);
        return NextResponse.json<CompleteSetResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
