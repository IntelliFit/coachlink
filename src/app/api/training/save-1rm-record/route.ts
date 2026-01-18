import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { Save1RMRecordDto, Save1RMRecordResponseDto } from "./entity";
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
    const body = await req.json() as Save1RMRecordDto;

    // 验证输入（weight 可为负数：仅对 includesBodyWeight=true 的动作表示“辅助重量”）
    if (!body.exercise_name || body.weight === null || body.weight === undefined || !Number.isFinite(body.weight)) {
        return NextResponse.json({
            success: false,
            message: "请输入有效的动作名称和重量",
            data: null,
        }, { status: 400 });
    }

    const weight = Number(body.weight);
    const reps = body.reps || 1;

    try {
        // 1. Determine if body weight is needed (Check DB first, then fallback)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: actionConfig } = await (supabase as any)
            .from("coach_actions")
            .select('"includesBodyWeight"')
            .eq("name", body.exercise_name)
            .limit(1)
            .maybeSingle();

        let includeBodyWeight: boolean;
        if (actionConfig && actionConfig.includesBodyWeight !== undefined) {
            includeBodyWeight = actionConfig.includesBodyWeight;
        } else {
            includeBodyWeight = requiresBodyWeightFallback(body.exercise_name);
        }

        // 2. Get user body weight if needed
        let userBodyWeight = 0;
        if (includeBodyWeight) {
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("weight")
                .eq("user_id", userId)
                .single();
            userBodyWeight = profile?.weight || 0;
        }

        // Validate weight according to action type
        if (!includeBodyWeight) {
            if (weight <= 0) {
                return NextResponse.json({
                    success: false,
                    message: "请输入有效的重量（>0）",
                    data: null,
                }, { status: 400 });
            }
        } else {
            // allow negative/zero external as long as total > 0
            if (!userBodyWeight || userBodyWeight <= 0) {
                return NextResponse.json({
                    success: false,
                    message: "缺少体重数据，无法为包含自重动作计算",
                    data: null,
                }, { status: 400 });
            }
            if (weight + userBodyWeight <= 0) {
                return NextResponse.json({
                    success: false,
                    message: "辅助重量过大（外加重量 + 体重 必须 > 0）",
                    data: null,
                }, { status: 400 });
            }
        }

        // 3. Calculate e1RM
        const e1rmResult = calculateE1RM({
            weight,
            reps,
            bodyWeight: userBodyWeight,
            includeBodyWeight,
        });

        const estimatedFrom = {
            weight,
            reps,
            bodyWeight: includeBodyWeight ? userBodyWeight : undefined,
            epley: e1rmResult.epley,
            brzycki: e1rmResult.brzycki,
            lombardi: e1rmResult.lombardi,
        };

        // 4. Check vs existing records
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingRecord } = await (supabase as any)
            .from("personal_records_history")
            .select("id, e1rm")
            .eq("user_id", userId)
            .eq("exercise_name", body.exercise_name)
            .order("e1rm", { ascending: false })
            .limit(1)
            .maybeSingle();

        let recordId: string;
        let isNewRecord: boolean;

        if (!existingRecord) {
            isNewRecord = true;
        } else if (e1rmResult.e1rm > (existingRecord.e1rm || 0)) {
            isNewRecord = true;
        } else {
            isNewRecord = false;
        }

        // 5. Insert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newRecord, error } = await (supabase as any)
            .from("personal_records_history")
            .insert({
                user_id: userId,
                action_id: body.action_id || null, // If provided in DTO
                exercise_name: body.exercise_name,
                weight: weight,
                reps: reps,
                e1rm: e1rmResult.e1rm,
                date_achieved: new Date().toISOString().split("T")[0],
                notes: body.notes ||
                    (isNewRecord ? "训练中记录的新PR" : "训练中记录的1RM"),
                is_auto_calculated: false,
                estimated_from: estimatedFrom,
            })
            .select("id")
            .single();

        if (error) {
            console.error("插入1RM记录失败:", error);
            return NextResponse.json({
                success: false,
                message: "保存1RM记录失败",
                data: null,
            }, { status: 500 });
        }

        recordId = newRecord.id;

        return NextResponse.json<ApiData<Save1RMRecordResponseDto>>({
            success: true,
            message: isNewRecord
                ? "🎉 恭喜！创建或打破个人记录！"
                : "✅ 1RM记录已保存",
            data: {
                record_id: recordId,
                is_new_record: isNewRecord,
                e1rm: e1rmResult.e1rm,
            },
        });
    } catch (error) {
        console.error("保存1RM记录失败:", error);
        return NextResponse.json({
            success: false,
            message: "保存1RM记录失败",
            data: null,
        }, { status: 500 });
    }
}
