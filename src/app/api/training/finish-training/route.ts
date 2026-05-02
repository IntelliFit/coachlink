import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { FinishTrainingDto, FinishTrainingResponseDto } from "./entity";
import {
    calculateE1RM,
    requiresBodyWeightFallback,
} from "@/lib/e1rmCalculator";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;

    const {
        training_record_id,
        notes,
    } = await req.json() as FinishTrainingDto;

    if (!training_record_id || training_record_id === "preview") {
        return NextResponse.json({
            success: false,
            message: "无效的训练记录ID",
            data: null,
        }, { status: 400 });
    }

    try {
        // 获取当前记录
        const { data: currentRecord, error: fetchError } = await supabase
            .from("training_records")
            .select("*")
            .eq("id", training_record_id)
            .eq("user_id", userId)
            .single();

        if (fetchError || !currentRecord) {
            return NextResponse.json({
                success: false,
                message: "训练记录不存在",
                data: null,
            }, { status: 404 });
        }

        // 计算训练时长
        const startedAt = currentRecord.started_at
            ? new Date(currentRecord.started_at)
            : new Date();
        const now = new Date();
        const durationMinutes = Math.round(
            (now.getTime() - startedAt.getTime()) / 60000,
        );

        // 更新记录为完成状态
        const { data: updatedRecord, error: updateError } = await supabase
            .from("training_records")
            .update({
                status: "completed",
                completed_at: now.toISOString(),
                duration_minutes: durationMinutes,
                notes: notes || currentRecord.notes || null,
                updated_at: now.toISOString(),
            })
            .eq("id", training_record_id)
            .select()
            .single();

        if (updateError) {
            console.error("完成训练失败:", updateError);
            throw updateError;
        }

        // 获取用户体重（仅一次查询）
        const { data: profile } = await supabase
            .from("user_profiles")
            .select("weight")
            .eq("user_id", userId)
            .single();
        const userBodyWeight = profile?.weight || 0;

        // 更新个人记录（从 exercises 中提取数据）
        if (currentRecord.exercises && Array.isArray(currentRecord.exercises)) {
            const exercisesToUpdate: any[] = [];

            // Extract exercises to update
            currentRecord.exercises.forEach((exercise: any) => {
                if (exercise.sets && Array.isArray(exercise.sets)) {
                    exercise.sets.forEach((set: any) => {
                        if (
                            set.status === "completed" && set.actual_weight &&
                            set.actual_reps
                        ) {
                            exercisesToUpdate.push({
                                name: exercise.exercise_name,
                                weight: set.actual_weight,
                                reps: set.actual_reps,
                                week_number: currentRecord.week_number,
                                day_of_week: currentRecord.day_number,
                            });
                        }
                    });
                }
            });

            if (exercisesToUpdate.length > 0) {
                // Fetch action properties (includeBodyWeight)
                const actionNames = exercisesToUpdate.map((e) => e.name);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: actionConfigs } = await (supabase as any)
                    .from("coach_actions")
                    .select('name, "includesBodyWeight"')
                    .in("name", actionNames);

                const actionConfigMap = new Map<string, boolean>();
                if (actionConfigs) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    actionConfigs.forEach((a: any) => {
                        if (a.includesBodyWeight !== undefined) {
                            actionConfigMap.set(a.name, a.includesBodyWeight);
                        }
                    });
                }

                // 调用更新个人记录的 API（内部调用，不通过 HTTP）
                for (const exercise of exercisesToUpdate) {
                    if (exercise.weight && exercise.reps) {
                        const weight = exercise.weight;
                        const reps = exercise.reps;

                        // Calculate e1RM
                        let includeBodyWeight = actionConfigMap.get(
                            exercise.name,
                        );
                        if (includeBodyWeight === undefined) {
                            includeBodyWeight = requiresBodyWeightFallback(
                                exercise.name,
                            );
                        }

                        const e1rmResult = calculateE1RM({
                            weight,
                            reps,
                            bodyWeight: userBodyWeight,
                            includeBodyWeight,
                        });

                        const estimatedFrom = {
                            weight,
                            reps,
                            bodyWeight: includeBodyWeight
                                ? userBodyWeight
                                : undefined,
                            epley: e1rmResult.epley,
                            brzycki: e1rmResult.brzycki,
                        };

                        // 检查当前最高 e1RM (从 personal_records_history)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const { data: existingRecord } = await (supabase as any)
                            .from("personal_records_history")
                            .select("id, e1rm")
                            .eq("user_id", userId)
                            .eq("exercise_name", exercise.name)
                            .order("e1rm", { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        // 只有当新纪录的 e1RM 大于旧纪录时才插入新 PR
                        if (
                            !existingRecord ||
                            (e1rmResult.e1rm > (existingRecord.e1rm || 0))
                        ) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (supabase as any).from(
                                "personal_records_history",
                            ).insert({
                                user_id: userId,
                                exercise_name: exercise.name,
                                weight: weight,
                                reps: reps,
                                e1rm: e1rmResult.e1rm,
                                date_achieved:
                                    new Date().toISOString().split("T")[0],
                                notes:
                                    `训练计划完成：第${currentRecord.week_number}周第${currentRecord.day_number}天`,
                                is_auto_calculated: true,
                                estimated_from: estimatedFrom,
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: "训练完成成功",
            data: { record: updatedRecord as any },
        });
    } catch (error: any) {
        console.error("完成训练失败:", error);
        return NextResponse.json({
            success: false,
            message: error.message || "完成训练失败",
            data: null,
        }, { status: 500 });
    }
}
