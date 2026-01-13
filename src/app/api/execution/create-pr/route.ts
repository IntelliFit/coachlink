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

        const today = new Date().toISOString().split("T")[0];

        // 防重复：如果该 execution/action/set 今日已存在记录（常见于 auto e1RM + 手动标记同一次训练）
        const { data: existing } = await (supabase as any)
            .from("personal_records_history")
            .select("id, is_auto_calculated")
            .eq("user_id", userId)
            .eq("execution_id", executionId)
            .eq("action_id", actionId)
            .eq("execution_set_number", setNumber)
            .eq("date_achieved", today)
            .maybeSingle();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const baseUpdate: any = {
            action_id: actionId,
            exercise_name: actionName,
            weight: weight,
            reps: reps,
            e1rm: e1rmResult.e1rm,
            load_formula: loadFormula,
            execution_id: executionId,
            execution_set_number: setNumber,
            date_achieved: today,
            notes: notes || null,
            video_url: videoUrl,
            is_verified: false,
            estimated_from: estimatedFrom,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = (supabase as any).from("personal_records_history");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let error: any = null;

        if (existing?.id) {
            // 保留原 is_auto_calculated，不强行改写（避免干扰 auto e1RM 的“当日只保留一条自动 PR”逻辑）
            const updateRes = await query
                .update(baseUpdate)
                .eq("id", existing.id)
                .select()
                .single();
            data = updateRes.data;
            error = updateRes.error;
        } else {
            const insertRes = await query
                .insert({
                    ...baseUpdate,
                    is_auto_calculated: false, // 手动标记的 PR（首次插入时）
                })
                .select()
                .single();
            data = insertRes.data;
            error = insertRes.error;
        }

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
