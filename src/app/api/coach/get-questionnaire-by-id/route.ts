import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type { TrainingItem } from "@/types/questionnaires";
import type { GetQuestionnaireByIdDto, GetQuestionnaireByIdResponseDto } from "./entity";

function normalizeQuestions(raw: any): TrainingItem[] {
    // 兼容错误/旧写法：{ templateName, questions: [...] }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const inner = (raw as any).questions;
        if (Array.isArray(inner)) return inner as TrainingItem[];
        if (inner && typeof inner === "object" && Array.isArray((inner as any).questions)) {
            return (inner as any).questions as TrainingItem[];
        }
        return [];
    }
    return Array.isArray(raw) ? (raw as TrainingItem[]) : [];
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
        .select("id, questions, is_active, status, version")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (error || !data) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "问卷不存在或无权限", data: null },
            { status: 404 },
        );
    }

    // 兼容旧数据：优先使用 status，如果没有则从 is_active 推导
    const status = data.status || (data.is_active ? 'active' : 'archived');
    const isActive = status === 'active';

    const resp: GetQuestionnaireByIdResponseDto = {
        id: data.id,
        questionnaires: normalizeQuestions(data.questions),
        is_active: isActive,
        version: data.version ?? null,
    };

    return NextResponse.json<ApiData<GetQuestionnaireByIdResponseDto>>({
        success: true,
        message: "获取问卷成功",
        data: resp,
    });
}

