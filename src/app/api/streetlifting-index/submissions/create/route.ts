import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingCreateSubmissionDto,
    StreetliftingCreateSubmissionResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = await req.json() as StreetliftingCreateSubmissionDto;

        const {
            gender,
            bodyweight,
            added_weight,
            reps,
            form_quality,
            penalty_weight = 0,
            user_name = null,
            video_url = null,
            pullup_type = null,
            exercise_type = "weighted_pullup",
        } = body;

        if (!gender || !bodyweight || !Number.isFinite(bodyweight)) {
            return NextResponse.json<ApiData<StreetliftingCreateSubmissionResponseDto>>({
                success: false,
                message: "请填写有效的性别和体重",
                data: null,
            }, { status: 400 });
        }

        if (!Number.isFinite(added_weight)) {
            return NextResponse.json<ApiData<StreetliftingCreateSubmissionResponseDto>>({
                success: false,
                message: "请填写有效的附加负重",
                data: null,
            }, { status: 400 });
        }

        if (!Number.isFinite(reps) || reps < 1 || reps > 36) {
            return NextResponse.json<ApiData<StreetliftingCreateSubmissionResponseDto>>({
                success: false,
                message: "完成次数必须在 1-36 之间",
                data: null,
            }, { status: 400 });
        }

        if (!form_quality) {
            return NextResponse.json<ApiData<StreetliftingCreateSubmissionResponseDto>>({
                success: false,
                message: "请选择动作质量",
                data: null,
            }, { status: 400 });
        }

        if (exercise_type === "weighted_pullup" && !pullup_type) {
            return NextResponse.json<ApiData<StreetliftingCreateSubmissionResponseDto>>({
                success: false,
                message: "负重引体需要选择引体类型",
                data: null,
            }, { status: 400 });
        }

        const db = serviceRoleSupabase;
        const { data, error } = await db
            .from("streetlifting_submissions")
            .insert([{
                gender,
                bodyweight,
                added_weight,
                reps,
                form_quality,
                penalty_weight,
                user_name,
                video_url,
                pullup_type: exercise_type === "weighted_pullup" ? pullup_type : null,
                exercise_type,
            }])
            .select("*")
            .single();

        if (error || !data) {
            console.error("[streetlifting-index][submissions] create error:", error);
            return NextResponse.json<ApiData<StreetliftingCreateSubmissionResponseDto>>({
                success: false,
                message: error?.message || "提交失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingCreateSubmissionResponseDto>>({
            success: true,
            message: "提交成功",
            data: {
                submission: data,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][submissions] create error:", error);
        return NextResponse.json<ApiData<StreetliftingCreateSubmissionResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
