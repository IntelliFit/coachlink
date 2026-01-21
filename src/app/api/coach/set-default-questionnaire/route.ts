import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type { SetDefaultQuestionnaireDto, SetDefaultQuestionnaireResponseDto } from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    if (!session.user.is_coach) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "用户不是教练", data: null },
            { status: 403 },
        );
    }

    const { id } = (await req.json()) as SetDefaultQuestionnaireDto;
    if (!id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少问卷ID", data: null },
            { status: 400 },
        );
    }

    const userId = session.user.id;

    // 验证该问卷属于当前教练（coach_id 存 users.id）
    const { data: q, error: qErr } = await supabase
        .from("coach_questionnaires")
        .select("id")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (qErr || !q) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "问卷不存在或无权限", data: null },
            { status: 404 },
        );
    }

    const { data: coach, error: coachErr } = await supabase
        .from("coaches")
        .select("id, profile")
        .eq("user_id", userId)
        .single();

    if (coachErr || !coach) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "教练信息不存在", data: null },
            { status: 404 },
        );
    }

    const nextProfile = {
        ...(coach.profile as any),
        default_questionnaire_id: id,
    };

    const { error: updErr } = await supabase
        .from("coaches")
        .update({ profile: nextProfile as any })
        .eq("id", coach.id);

    if (updErr) {
        console.error("[set-default-questionnaire] failed:", updErr);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "设置默认问卷失败", data: null },
            { status: 500 },
        );
    }

    const resp: SetDefaultQuestionnaireResponseDto = { id };
    return NextResponse.json<ApiData<SetDefaultQuestionnaireResponseDto>>({
        success: true,
        message: "已设置为默认问卷",
        data: resp,
    });
}

