import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type { GetQuestionnaireByIdDto, GetQuestionnaireByIdResponseDto } from "./entity";
import { parseQuestionnaireDocument } from "@/lib/questionnaireDocument";

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

    const { id } = (await req.json()) as GetQuestionnaireByIdDto;
    if (!id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少问卷ID", data: null },
            { status: 400 },
        );
    }

    const userId = session.user.id;
    const { data, error } = await supabase
        .from("coach_questionnaires")
        .select("id, questions, status, version, name")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (error || !data) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "问卷不存在或无权限", data: null },
            { status: 404 },
        );
    }

    const status: "active" | "draft" = data.status === "active" ? "active" : "draft";
    const document = parseQuestionnaireDocument(data.questions);

    const resp: GetQuestionnaireByIdResponseDto = {
        id: data.id,
        name: data.name ?? null,
        status,
        questionnaires: document.questions,
        editorType: document.editorType,
        version: data.version ?? null,
    };

    return NextResponse.json<ApiData<GetQuestionnaireByIdResponseDto>>({
        success: true,
        message: "获取问卷成功",
        data: resp,
    });
}
