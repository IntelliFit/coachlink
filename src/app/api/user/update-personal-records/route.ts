import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import type {
    UpdatePersonalRecordsDto,
    UpdatePersonalRecordsResponseDto,
} from "./entity";
import { ApiData } from "@/types/api";
import {
    calculateE1RM,
    requiresBodyWeightFallback,
} from "@/lib/e1rmCalculator";

export async function POST(req: Request) {
    // 优先使用原有的session鉴权（保持向后兼容）
    const session = await getServerSession();
    let userId: string | null = null;

    if (session?.user?.id) {
        // 网页端：使用session
        userId = session.user.id;
    } else {
        // 小程序端：尝试从token获取
        const auth = await getAuthUser(req);
        if (auth.isAuthenticated && auth.userId) {
            userId = auth.userId;
        }
    }

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const {
        exercises,
    } = await req.json() as UpdatePersonalRecordsDto;

    // 验证训练数据
    if (!exercises || !Array.isArray(exercises)) {
        return NextResponse.json({
            success: false,
            message: "训练数据格式错误",
            data: null,
        }, { status: 400 });
    }

    // Get user's body weight
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("weight")
        .eq("user_id", userId)
        .single();
    const userBodyWeight = profile?.weight || 0;

    // Fetch action properties (includeBodyWeight) from coach_actions
    const actionNames = exercises.map((e) => e.name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: actionConfigs } = await (supabase as any)
        .from("coach_actions")
        .select('name, "includesBodyWeight"')
        .in("name", actionNames);

    const actionConfigMap = new Map<string, boolean>();
    if (actionConfigs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actionConfigs.forEach((a: any) => {
            if (a.includesBodyWeight) {
                actionConfigMap.set(a.name, true);
            }
        });
    }

    // 更新个人记录 - 使用 personal_records_history 表
    for (const exercise of exercises) {
        if (exercise.load_actual && exercise.reps_completed) {
            const weight = exercise.load_actual;
            const reps = exercise.reps_completed;

            // Determine if body weight is included
            // Priority: 1. DB Config, 2. Fallback Name Match
            let includeBodyWeight = actionConfigMap.get(exercise.name);
            if (includeBodyWeight === undefined) {
                includeBodyWeight = requiresBodyWeightFallback(exercise.name);
            }

            // Calculate e1RM
            const e1rmResult = calculateE1RM({
                weight,
                reps,
                bodyWeight: userBodyWeight,
                includeBodyWeight,
            });

            // Check if this is a new PR
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existingRecord } = await (supabase as any)
                .from("personal_records_history")
                .select("id, e1rm")
                .eq("user_id", userId)
                .eq("exercise_name", exercise.name)
                .order("e1rm", { ascending: false })
                .limit(1)
                .maybeSingle();

            // Only insert if no record exists or this e1rm is higher
            if (
                !existingRecord ||
                (e1rmResult.e1rm > (existingRecord.e1rm || 0))
            ) {
                const estimatedFrom = {
                    weight,
                    reps,
                    bodyWeight: includeBodyWeight ? userBodyWeight : undefined,
                    epley: e1rmResult.epley,
                    brzycki: e1rmResult.brzycki,
                };

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any).from("personal_records_history").insert(
                    {
                        user_id: userId,
                        exercise_name: exercise.name,
                        weight: weight,
                        reps: reps,
                        e1rm: e1rmResult.e1rm,
                        date_achieved: new Date().toISOString().split("T")[0],
                        notes:
                            `训练计划完成：${exercise.week_number}周${exercise.day_of_week}`,
                        is_auto_calculated: true,
                        estimated_from: estimatedFrom,
                    },
                );
            }
        }
    }

    return NextResponse.json<ApiData<UpdatePersonalRecordsResponseDto>>({
        success: true,
        message: "个人记录更新成功",
        data: "个人记录更新成功",
    });
}
