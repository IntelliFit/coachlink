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

    // 1. 先清除其他问卷的 is_default 标记（每个教练只能有一个默认问卷）
    const { error: clearErr } = await supabase
        .from("coach_questionnaires")
        .update({ is_default: false })
        .eq("coach_id", userId);

    if (clearErr) {
        console.error("[set-default-questionnaire] clear is_default failed:", clearErr);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "设置默认问卷失败（清除旧标记失败）", data: null },
            { status: 500 },
        );
    }

    // 2. 设置新问卷的 is_default 标记
    const { error: setErr } = await supabase
        .from("coach_questionnaires")
        .update({ is_default: true })
        .eq("id", id)
        .eq("coach_id", userId);

    if (setErr) {
        console.error("[set-default-questionnaire] set is_default failed:", setErr);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "设置默认问卷失败（设置新标记失败）", data: null },
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
