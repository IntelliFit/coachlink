import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    ListQuestionnairesDto,
    ListQuestionnairesResponseDto,
} from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
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

    // 教练端：默认查自己的问卷（coach_questionnaires.coach_id 存的是 users.id）
    let coachUserId = session.user.id;

    // 如需查看某教练的模板（传 coaches.id）
    if (body.coachId) {
        const { data: coach, error } = await supabase
            .from("coaches")
            .select("user_id, profile")
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
        // 仅教练可查看自己的问卷列表
        if (!session.user.is_coach) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "用户不是教练", data: null },
                { status: 403 },
            );
        }
    }

    // 读取默认问卷 id：统一使用 is_default 字段
    // 简化逻辑：只使用 is_default，不再依赖 coaches.profile.default_questionnaire_id
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
            "id, questions, is_active, status, name, is_default, version, created_at, updated_at",
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

    // UI 简化为固定两份：
    // - 线上版本：status='active' 且 is_active=true
    // - 草稿版本：status='draft' 且 is_active=false
    //
    // 兼容旧数据：
    // - 若 status 为空：用 is_active 推导（true=active，false=draft），并尽量只取一份草稿
    const all = (rows || []) as any[];
    const online =
        all.find((r) => r.status === "active" && r.is_active === true) ||
        all.find((r) => r.is_active === true) ||
        null;

    const draft =
        all.find((r) => r.status === "draft" && r.is_active === false) ||
        all.find((r) => !r.status && r.is_active === false) ||
        null;

    const items = [online, draft]
        .filter(Boolean)
        .map((r: any) => ({
            id: r.id,
            name: r.name || (r.status === "active" || r.is_active ? "线上版本" : "草稿版本"),
            is_active: Boolean(r.is_active),
            version: r.version ?? null,
            created_at: r.created_at ?? null,
            updated_at: r.updated_at ?? null,
            is_default: r.is_default ||
                (defaultId ? r.id === defaultId : false),
        }));

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
