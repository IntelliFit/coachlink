import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import { parseQuestionnaireDocument } from "@/lib/questionnaireDocument";
import type {
    DuplicateQuestionnaireDto,
    DuplicateQuestionnaireResponseDto,
} from "./entity";

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

    const { id, name } = (await req.json()) as DuplicateQuestionnaireDto;
    if (!id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少来源问卷ID", data: null },
            { status: 400 },
        );
    }

    const userId = session.user.id;
    const { data: src, error: srcErr } = await supabase
        .from("coach_questionnaires")
        .select("id, coach_id, questions, name, version")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (srcErr || !src) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "来源问卷不存在或无权限", data: null },
            { status: 404 },
        );
    }

    const document = parseQuestionnaireDocument(src.questions);
    const fallbackName = document.editorType === "flow" ? "流程图问卷" : "列表问卷";
    const nextName = name?.trim() || `${src.name || fallbackName} 副本`;

    const { data: created, error: insErr } = await supabase
        .from("coach_questionnaires")
        .insert({
            coach_id: userId,
            name: nextName,
            questions: document as any,
            status: "draft",
            is_default: false,
            version: src.version ?? 1,
        } as any)
        .select("id")
        .single();

    if (insErr || !created) {
        console.error("[duplicate-questionnaire] insert failed:", insErr);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "复制问卷失败", data: null },
            { status: 500 },
        );
    }

    const resp: DuplicateQuestionnaireResponseDto = { id: created.id };
    return NextResponse.json<ApiData<DuplicateQuestionnaireResponseDto>>({
        success: true,
        message: "已复制问卷",
        data: resp,
    });
}
