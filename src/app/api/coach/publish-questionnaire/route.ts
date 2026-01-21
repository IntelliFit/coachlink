import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type { PublishQuestionnaireDto, PublishQuestionnaireResponseDto } from "./entity";

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

    const { id } = (await req.json()) as PublishQuestionnaireDto;
    if (!id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少灰度问卷ID", data: null },
            { status: 400 },
        );
    }

    const userId = session.user.id;

    // Ensure the draft belongs to this coach
    const { data: draft, error: draftErr } = await supabase
        .from("coach_questionnaires")
        .select("id, is_active, version")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (draftErr || !draft) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "灰度问卷不存在或无权限", data: null },
            { status: 404 },
        );
    }

    if (draft.is_active) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "该问卷已经是线上版本", data: null },
            { status: 400 },
        );
    }

    // 1) Demote current online questionnaires
    const { error: demoteErr } = await supabase
        .from("coach_questionnaires")
        .update({ is_active: false, updated_at: new Date().toISOString() } as any)
        .eq("coach_id", userId)
        .eq("is_active", true);

    if (demoteErr) {
        console.error("[publish-questionnaire] demote failed:", demoteErr);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "发布失败（下线旧线上版本失败）", data: null },
            { status: 500 },
        );
    }

    // 2) Promote draft to online, bump version
    const nextVersion = (draft.version ?? 1) + 1;
    const { data: promoted, error: promoteErr } = await supabase
        .from("coach_questionnaires")
        .update({
            is_active: true,
            version: nextVersion,
            updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id)
        .select("id")
        .single();

    if (promoteErr || !promoted) {
        console.error("[publish-questionnaire] promote failed:", promoteErr);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "发布失败（上线灰度版本失败）", data: null },
            { status: 500 },
        );
    }

    const resp: PublishQuestionnaireResponseDto = { id: promoted.id };
    return NextResponse.json<ApiData<PublishQuestionnaireResponseDto>>({
        success: true,
        message: "已发布为线上版本",
        data: resp,
    });
}

