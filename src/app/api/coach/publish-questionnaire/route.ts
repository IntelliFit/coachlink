import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    PublishQuestionnaireDto,
    PublishQuestionnaireResponseDto,
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

    const { id } = (await req.json()) as PublishQuestionnaireDto;
    if (!id) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少草稿问卷ID", data: null },
            { status: 400 },
        );
    }

    const userId = session.user.id;

    // Ensure the draft belongs to this coach
    const { data: draft, error: draftErr } = await supabase
        .from("coach_questionnaires")
        .select("id, is_active, status, version, questions")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (draftErr || !draft) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "草稿问卷不存在或无权限", data: null },
            { status: 404 },
        );
    }

    if (draft.is_active) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "该问卷已经是线上版本", data: null },
            { status: 400 },
        );
    }

    // 0) 统一草稿标记（允许旧数据没有 status）
    // 如果传入的并非 draft 状态，也允许发布，但会按草稿发布处理

    // 1) Demote current online questionnaires to archived
    const { data: allQuestionnaires } = await supabase
        .from("coach_questionnaires")
        .select("id, is_active, status")
        .eq("coach_id", userId);

    // 查找线上版本：优先 status='active'，兼容旧数据用 is_active=true
    const currentOnline = (allQuestionnaires || []).filter((q: any) =>
        (q.status === "active" && q.is_active === true) || (q.is_active === true)
    );

    if (currentOnline && currentOnline.length > 0) {
        const { error: demoteErr } = await supabase
            .from("coach_questionnaires")
            .update({
                is_active: false,
                status: "archived",
                updated_at: new Date().toISOString(),
            } as any)
            .in("id", currentOnline.map((q) => q.id));

        if (demoteErr) {
            console.error("[publish-questionnaire] demote failed:", demoteErr);
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: "发布失败（下线旧线上版本失败）",
                    data: null,
                },
                { status: 500 },
            );
        }
    }

    // 2) Promote draft to online, bump version
    const nextVersion = (draft.version ?? 1) + 1;
    const { data: promoted, error: promoteErr } = await supabase
        .from("coach_questionnaires")
        .update({
            is_active: true,
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
                message: "发布失败（上线草稿版本失败）",
                data: null,
            },
            { status: 500 },
        );
    }

    // 3) Ensure there is a draft slot after publishing:
    // Create a new draft copy based on the content that just went online.
    // This prevents "draft tab" from accidentally picking an archived old-online row.
    const nextDraftQuestions = draft.questions;

    // 先把其它 draft 标记的问卷都归档（最多只保留一个草稿槽位）
    await supabase
        .from("coach_questionnaires")
        .update({ status: "archived", is_active: false, updated_at: new Date().toISOString() } as any)
        .eq("coach_id", userId)
        .eq("status", "draft");

    // 再创建新的草稿副本
    const { error: createDraftErr } = await supabase
        .from("coach_questionnaires")
        .insert({
            coach_id: userId,
            questions: nextDraftQuestions as any,
            is_active: false,
            status: "draft",
            version: nextVersion, // 草稿跟随最新线上版本号，便于识别
        } as any);

    if (createDraftErr) {
        // 不阻断发布成功，但打印日志便于排查
        console.error("[publish-questionnaire] create draft copy failed:", createDraftErr);
    }

    const resp: PublishQuestionnaireResponseDto = { id: promoted.id };
    return NextResponse.json<ApiData<PublishQuestionnaireResponseDto>>({
        success: true,
        message: "已发布为线上版本",
        data: resp,
    });
}
