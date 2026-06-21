import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";

import type { ApiData } from "@/types/api";
import type {
    PublishQuestionnaireDto,
    PublishQuestionnaireResponseDto,
} from "./entity";

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

    if (authResult.user?.is_coach !== true) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "用户不是教练", data: null },
            { status: 403 },
        );
    }

    const { id } = (await req.json()) as PublishQuestionnaireDto;
    if (!id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少问卷ID", data: null },
            { status: 400 },
        );
    }

    const userId = authResult.userId;

    const { data: target, error: targetErr } = await supabase
        .from("coach_questionnaires")
        .select("id, status, version")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (targetErr || !target) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "问卷不存在或无权限", data: null },
            { status: 404 },
        );
    }

    if (target.status === "active") {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "该问卷已经是已发布版本", data: null },
            { status: 400 },
        );
    }

    // 先把当前已发布的降回 draft，保证只有一个 active
    const { error: demoteErr } = await supabase
        .from("coach_questionnaires")
        .update({
            status: "draft",
            updated_at: new Date().toISOString(),
        } as any)
        .eq("coach_id", userId)
        .eq("status", "active");

    if (demoteErr) {
        console.error("[publish-questionnaire] demote failed:", demoteErr);
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message: "发布失败（下线旧问卷失败）",
                data: null,
            },
            { status: 500 },
        );
    }

    // 发布目标问卷
    const nextVersion = (target.version ?? 1) + 1;
    const { data: promoted, error: promoteErr } = await supabase
        .from("coach_questionnaires")
        .update({
            status: "active",
            version: nextVersion,
            updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id)
        .select("id")
        .single();

    if (promoteErr || !promoted) {
        console.error("[publish-questionnaire] promote failed:", promoteErr);
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message: "发布失败（发布问卷失败）",
                data: null,
            },
            { status: 500 },
        );
    }

    const resp: PublishQuestionnaireResponseDto = { id: promoted.id };
    return NextResponse.json<ApiData<PublishQuestionnaireResponseDto>>({
        success: true,
        message: "已发布问卷",
        data: resp,
    });
}
