import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { sendDirectMessage } from "@/lib/chat";

import type { ApiData } from "@/types/api";
import type {
    SubmitFeedbackDto,
    SubmitFeedbackResponseDto,
} from "./entity";

/**
 * POST /api/execution/submit-feedback
 *
 * 学员完成训练后提交反馈给教练
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const { executionId, content, difficultyRating } =
            (await req.json()) as SubmitFeedbackDto;

        if (!executionId || !content?.trim()) {
            return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
                success: false,
                message: "缺少必要参数",
                data: null,
            }, { status: 400 });
        }

        if (content.trim().length > 500) {
            return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
                success: false,
                message: "反馈内容不能超过500字",
                data: null,
            }, { status: 400 });
        }

        // 验证 execution 归属并获取 instance_id + day_index
        const { data: execution, error: exeErr } = await supabase
            .from("plan_instance_executions")
            .select("id, student_id, instance_id, day_index")
            .eq("id", executionId)
            .single();

        if (exeErr || !execution) {
            return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
                success: false,
                message: "执行记录不存在",
                data: null,
            }, { status: 404 });
        }

        if (execution.student_id !== userId) {
            return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }

        if (!execution.instance_id) {
            return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
                success: false,
                message: "该执行记录未关联计划实例",
                data: null,
            }, { status: 400 });
        }

        // 检查是否已提交过反馈（一次执行仅允许一条）
        const { data: existing } = await supabase
            .from("execution_feedbacks")
            .select("id")
            .eq("execution_id", executionId)
            .maybeSingle();

        if (existing) {
            return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
                success: false,
                message: "该次训练已提交过反馈",
                data: null,
            }, { status: 409 });
        }

        // 写入反馈
        const insertPayload: Record<string, unknown> = {
            execution_id: executionId,
            instance_id: execution.instance_id,
            student_id: userId,
            day_index: execution.day_index,
            content: content.trim(),
        };

        if (
            difficultyRating &&
            difficultyRating >= 1 &&
            difficultyRating <= 5
        ) {
            insertPayload.difficulty_rating = Math.round(difficultyRating);
        }

        const { data: feedback, error: insertErr } = await supabase
            .from("execution_feedbacks")
            .insert(insertPayload)
            .select("id, created_at")
            .single();

        if (insertErr || !feedback) {
            console.error("[submit-feedback] insert failed:", insertErr);
            return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
                success: false,
                message: "保存反馈失败",
                data: null,
            }, { status: 500 });
        }

        // 同步以私信形式发给教练，便于及时查看
        try {
            const { data: instance } = await supabase
                .from("coach_plan_instances")
                .select("coach_id")
                .eq("id", execution.instance_id)
                .single();

            if (instance?.coach_id) {
                const { data: coach } = await supabase
                    .from("coaches")
                    .select("user_id")
                    .eq("id", instance.coach_id)
                    .single();

                if (coach?.user_id && coach.user_id !== userId) {
                    const DIFFICULTY_MAP: Record<number, string> = {
                        1: "太轻松",
                        2: "轻松",
                        3: "刚好",
                        4: "有点难",
                        5: "太难了",
                    };
                    const difficultyText =
                        difficultyRating && difficultyRating >= 1 && difficultyRating <= 5
                            ? DIFFICULTY_MAP[difficultyRating] ?? difficultyRating
                            : null;
                    const messageParts = [
                        `【训练反馈】完成第 ${execution.day_index} 天训练后提交了反馈`,
                        difficultyText ? `难度：${difficultyText}` : null,
                        `内容：${content.trim()}`,
                    ].filter(Boolean);
                    const messageContent = messageParts.join("\n");

                    await sendDirectMessage({
                        fromUserId: userId,
                        toUserId: coach.user_id,
                        content: messageContent,
                        contentMetadata: {
                            type: "training_feedback",
                            execution_id: executionId,
                            instance_id: execution.instance_id,
                            day_index: execution.day_index,
                        },
                    });
                }
            }
        } catch (dmErr) {
            console.warn("[submit-feedback] send direct message to coach failed:", dmErr);
            // 私信失败不阻塞反馈提交成功
        }

        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: true,
            message: "反馈提交成功",
            data: {
                id: feedback.id,
                created_at: feedback.created_at,
            },
        });
    } catch (error) {
        console.error("[submit-feedback] error:", error);
        return NextResponse.json<ApiData<SubmitFeedbackResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

