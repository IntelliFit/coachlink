import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingClaimSubmissionDto,
    StreetliftingClaimSubmissionResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id;
        if (!userId) {
            return NextResponse.json<ApiData<StreetliftingClaimSubmissionResponseDto>>(
                {
                    success: false,
                    message: "请先登录后再认领",
                    data: null,
                },
                { status: 401 },
            );
        }

        const body = (await req.json()) as StreetliftingClaimSubmissionDto;
        const { submission_id } = body;

        if (!submission_id) {
            return NextResponse.json<ApiData<StreetliftingClaimSubmissionResponseDto>>({
                success: false,
                message: "请提供提交记录ID",
                data: null,
            }, { status: 400 });
        }

        const db = serviceRoleSupabase;

        // 检查提交记录是否存在且没有 user_id
        const { data: existing, error: fetchError } = await db
            .from("streetlifting_submissions")
            .select("id, user_id")
            .eq("id", submission_id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json<ApiData<StreetliftingClaimSubmissionResponseDto>>({
                success: false,
                message: "提交记录不存在",
                data: null,
            }, { status: 404 });
        }

        if (existing.user_id) {
            return NextResponse.json<ApiData<StreetliftingClaimSubmissionResponseDto>>({
                success: false,
                message: "该数据已被认领",
                data: null,
            }, { status: 400 });
        }

        // 检查用户是否已有数据，如果有则先删除旧数据
        const { data: existingUserData } = await db
            .from("streetlifting_submissions")
            .select("id")
            .eq("user_id", userId)
            .limit(1);

        if (existingUserData && existingUserData.length > 0) {
            // 删除用户已有的数据
            await db
                .from("streetlifting_submissions")
                .delete()
                .eq("user_id", userId);
        }

        // 更新 user_id
        const { data, error } = await db
            .from("streetlifting_submissions")
            .update({ user_id: userId })
            .eq("id", submission_id)
            .select("*")
            .single();

        if (error || !data) {
            console.error("[streetlifting-index][submissions] claim error:", error);
            return NextResponse.json<ApiData<StreetliftingClaimSubmissionResponseDto>>({
                success: false,
                message: error?.message || "认领失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingClaimSubmissionResponseDto>>({
            success: true,
            message: "认领成功",
            data: {
                submission: data as any,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][submissions] claim error:", error);
        return NextResponse.json<ApiData<StreetliftingClaimSubmissionResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
