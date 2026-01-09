import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import type { CreatePRDto, CreatePRResponseDto } from "../entity";
import {
    calculateE1RM,
    requiresBodyWeightFallback,
} from "@/lib/e1rmCalculator";

/**
 * POST /api/execution/create-pr
 *
 * 创建个人记录（PR）- 手动标记的进步组
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: execution } = await (supabase as any)
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

        // 1. Check DB for body weight property
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: actionConfig } = await (supabase as any)
            .from("coach_actions")
            .select('"includesBodyWeight"')
            .eq("name", actionName)
            .limit(1)
            .maybeSingle();

        let includeBodyWeight: boolean;
        if (actionConfig && actionConfig.includesBodyWeight !== undefined) {
            includeBodyWeight = actionConfig.includesBodyWeight;
        } else {
            includeBodyWeight = requiresBodyWeightFallback(actionName);
        }

        // 2. Get user body weight if needed
        let bodyWeight = 0;
        if (includeBodyWeight) {
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("weight")
                .eq("user_id", userId)
                .single();
            bodyWeight = profile?.weight || 0;
        }

        // 计算 e1RM
        const e1rmResult = calculateE1RM({
            weight,
            reps,
            bodyWeight,
            includeBodyWeight,
        });

        const estimatedFrom = {
            weight,
            reps,
            bodyWeight: includeBodyWeight ? bodyWeight : undefined,
            epley: e1rmResult.epley,
            brzycki: e1rmResult.brzycki,
            lombardi: e1rmResult.lombardi,
        };

        // 插入PR记录 (使用新的 weight/reps/e1rm 列)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from("personal_records_history")
            .insert({
                user_id: userId,
                action_id: actionId,
                exercise_name: actionName,
                weight: weight, // 训练重量
                reps: reps, // 训练次数
                e1rm: e1rmResult.e1rm, // 计算的 e1RM
                load_formula: loadFormula,
                execution_id: executionId,
                execution_set_number: setNumber,
                date_achieved: new Date().toISOString().split("T")[0],
                notes: notes || null,
                video_url: videoUrl,
                is_verified: false,
                is_auto_calculated: false, // 手动标记的 PR
                estimated_from: estimatedFrom,
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
                weight: data.weight,
                reps: data.reps,
                e1rm: data.e1rm,
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
