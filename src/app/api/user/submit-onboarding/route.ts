import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const { userId, coachId, answers, baseline_video_urls } = await request
            .json();

        const effectiveUserId = userId || session.user.id;

        const { data, error } = await supabase
            .from("onboarding_questionnaires")
            .insert({
                user_id: effectiveUserId,
                coach_id: coachId ?? null,
                answers,
                baseline_video_urls: Array.isArray(baseline_video_urls)
                    ? baseline_video_urls
                    : [],
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        // Initial 1RM data remains in the questionnaire answers (JSON).
        // It is NOT inserted into personal_records_history.
        // The E1RM History API will fetch it directly from this table.

        return NextResponse.json({
            success: true,
            message: "提交问卷成功",
            data,
        });
    } catch (error: any) {
        console.error("提交问卷失败:", error);
        return NextResponse.json({
            success: false,
            message: error.message || "提交问卷失败",
            data: null,
        }, { status: 500 });
    }
}
