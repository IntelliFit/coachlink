import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";

import type { ApiData } from "@/types/api";
import type {
    ListQuestionnairesDto,
    ListQuestionnairesResponseDto,
} from "./entity";
import { parseQuestionnaireDocument } from "@/lib/questionnaireDocument";

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id, user: session.user }
        : await getAuthUser(req);
    if (!authResult.userId) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    let body: ListQuestionnairesDto = {};
    try {
        body = (await req.json()) as ListQuestionnairesDto;
    } catch {
        body = {};
    }

    let coachUserId = authResult.userId;

    if (body.coachId) {
        const { data: coach, error } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", body.coachId)
            .single();

        if (error || !coach?.user_id) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "获取教练信息失败", data: null },
                { status: 500 },
            );
        }
        coachUserId = coach.user_id;
    } else {
        if (authResult.user?.is_coach !== true) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "用户不是教练", data: null },
                { status: 403 },
            );
        }
    }

    const { data: defaultQuestionnaire } = await supabase
        .from("coach_questionnaires")
        .select("id")
        .eq("coach_id", coachUserId)
        .eq("is_default", true)
        .maybeSingle();

    const defaultId = defaultQuestionnaire?.id || null;

    const { data: rows, error } = await supabase
        .from("coach_questionnaires")
        .select(
            "id, questions, status, name, is_default, version, created_at, updated_at",
        )
        .eq("coach_id", coachUserId)
        .order("updated_at", { ascending: false });

    if (error) {
        console.error("[list-questionnaires] failed:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "获取问卷列表失败", data: null },
            { status: 500 },
        );
    }

    const items = ((rows || []) as any[]).map((r: any) => {
        const document = parseQuestionnaireDocument(r.questions);
        const status = r.status === "active" ? "active" : "draft";
        const fallbackName = document.editorType === "flow" ? "流程图问卷" : "列表问卷";

        return {
            id: r.id,
            name: r.name || fallbackName,
            version: r.version ?? null,
            created_at: r.created_at ?? null,
            updated_at: r.updated_at ?? null,
            is_default: Boolean(r.is_default),
            status,
            editorType: document.editorType,
        };
    });

    const resp: ListQuestionnairesResponseDto = {
        items,
        defaultId,
    };

    return NextResponse.json<ApiData<ListQuestionnairesResponseDto>>({
        success: true,
        message: "获取问卷列表成功",
        data: resp,
    });
}
