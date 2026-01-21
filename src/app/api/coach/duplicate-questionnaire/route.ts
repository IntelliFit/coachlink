import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type { DuplicateQuestionnaireDto, DuplicateQuestionnaireResponseDto } from "./entity";

function normalizeQuestions(raw: any): any[] {
    // 兼容错误/旧写法：{ templateName, questions: [...] }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const inner = (raw as any).questions;
        if (Array.isArray(inner)) return inner;
        if (inner && typeof inner === "object" && Array.isArray((inner as any).questions)) {
            return (inner as any).questions;
        }
        return [];
    }
    return Array.isArray(raw) ? raw : [];
}

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
        .select("id, coach_id, questions")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (srcErr || !src) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "来源问卷不存在或无权限", data: null },
            { status: 404 },
        );
    }

    // IMPORTANT: 目前 questions 字段仍保持为数组（TrainingItem[]）
    // “模板名称/版本标签”由 UI 侧固定显示为“线上/灰度”，后续迁移后再存 name/status。
    const nextQuestions = normalizeQuestions(src.questions);

    // “灰度版本”策略：如果已有草稿（is_active=false）则覆盖更新，否则创建新草稿
    const { data: existingDraft } = await supabase
        .from("coach_questionnaires")
        .select("id")
        .eq("coach_id", userId)
        .eq("is_active", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    let newId: string | null = null;
    if (existingDraft?.id) {
        const { data: updated, error: updErr } = await supabase
            .from("coach_questionnaires")
            .update({
                questions: nextQuestions as any,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existingDraft.id)
            .select("id")
            .single();

        if (updErr || !updated) {
            console.error("[duplicate-questionnaire] update draft failed:", updErr);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "复制到灰度版本失败", data: null },
                { status: 500 },
            );
        }
        newId = updated.id;
    } else {
        const { data: created, error: insErr } = await supabase
            .from("coach_questionnaires")
            .insert({
                coach_id: userId,
                questions: nextQuestions as any,
                is_active: false,
                version: 1,
            } as any)
            .select("id")
            .single();

        if (insErr || !created) {
            console.error("[duplicate-questionnaire] insert failed:", insErr);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "创建灰度版本失败", data: null },
                { status: 500 },
            );
        }
        newId = created.id;
    }

    const resp: DuplicateQuestionnaireResponseDto = { id: newId! };
    return NextResponse.json<ApiData<DuplicateQuestionnaireResponseDto>>({
        success: true,
        message: "已复制到灰度版本",
        data: resp,
    });
}

