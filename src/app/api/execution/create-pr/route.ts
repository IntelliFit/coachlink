import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { CreatePRDto, CreatePRResponseDto } from "../entity";

/**
 * POST /api/execution/create-pr
 *
 * 创建个人记录（PR）
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<CreatePRResponseDto>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const body: CreatePRDto = await request.json();
        const {
            executionId,
            actionId,
            actionName,
            setNumber,
            weight,
            reps,
            rpe,
            notes,
            videoId,
        } = body;

        if (
            !executionId || !actionId || !actionName || !setNumber ||
            weight === undefined || reps === undefined
        ) {
            return NextResponse.json<CreatePRResponseDto>(
                { success: false, message: "缺少必填参数" },
                { status: 400 },
            );
        }

        // 验证执行记录权限
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select("student_id")
            .eq("id", executionId)
            .single();

        if (!execution || execution.student_id !== userId) {
            return NextResponse.json<CreatePRResponseDto>(
                { success: false, message: "无权限" },
                { status: 403 },
            );
        }

        // 获取视频URL（如果有）
        let videoUrl = null;
        if (videoId) {
            const { data: video } = await supabase
                .from("execution_set_videos")
                .select("video_url")
                .eq("id", videoId)
                .single();

            if (video) {
                videoUrl = video.video_url;
            }
        }

        // 构造负荷公式
        const loadFormula = `${weight}kg × ${reps}次${
            rpe ? ` @ RPE ${rpe}` : ""
        }`;

        // 插入PR记录
        const { data, error } = await supabase
            .from("personal_records_history")
            .insert({
                user_id: userId,
                action_id: actionId,
                exercise_name: actionName,
                max_weight: weight,
                max_reps: reps,
                load_formula: loadFormula,
                execution_id: executionId,
                execution_set_number: setNumber,
                date_achieved: new Date().toISOString().split("T")[0], // 今天日期
                notes: notes || null,
                video_url: videoUrl,
                is_verified: false,
            })
            .select()
            .single();

        if (error) {
            console.error("创建PR失败:", error);
            return NextResponse.json<CreatePRResponseDto>(
                { success: false, message: "创建失败" },
                { status: 500 },
            );
        }

        return NextResponse.json<CreatePRResponseDto>({
            success: true,
            data: {
                id: data.id,
                user_id: data.user_id,
                exercise_name: data.exercise_name,
                max_weight: data.max_weight,
                max_reps: data.max_reps,
                load_formula: data.load_formula,
                date_achieved: data.date_achieved,
            },
        });
    } catch (error) {
        console.error("创建PR失败:", error);
        return NextResponse.json<CreatePRResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
