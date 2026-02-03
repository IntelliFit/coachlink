import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    SubmitPublicActionEditDto,
    SubmitPublicActionEditResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id || null;
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "用户未登录", data: null },
                { status: 401 },
            );
        }

        const body = (await req.json()) as SubmitPublicActionEditDto;
        const { actionId } = body;
        if (!actionId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 actionId", data: null },
                { status: 400 },
            );
        }

        const { data: action, error: fetchError } = await supabase
            .from("community_actions")
            .select("*")
            .eq("id", actionId)
            .single();

        if (fetchError || !action) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "公共动作不存在", data: null },
                { status: 404 },
            );
        }

        const proposedUrl = (body.url ?? action.url) ?? null;
        if (!proposedUrl || !String(proposedUrl).trim()) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "演示视频链接必填", data: null },
                { status: 400 },
            );
        }

        const proposed = {
            proposed_name: (body.name ?? action.name) as string,
            proposed_detail: (body.detail ?? action.detail) ?? null,
            proposed_positions: (body.positions ?? action.positions) ?? null,
            proposed_attrs: (body.attrs ?? action.attrs) ?? null,
            proposed_url: proposedUrl,
            proposed_type: (body.type ?? action.type) ?? null,
            proposed_item_schema: (body.item_schema ?? action.item_schema) ?? null,
            proposed_suggested_time: (body.suggested_time ?? action.suggested_time) ?? null,
            proposed_enableAutoWeightCompute:
                (body.enableAutoWeightCompute ?? action.enableAutoWeightCompute) ?? false,
            proposed_includesBodyWeight:
                (body.includesBodyWeight ?? action.includesBodyWeight) ?? false,
            proposed_canonical_action_id:
                (body.canonical_action_id ?? action.canonical_action_id) ?? null,
        };

        const { data: edit, error: insertError } = await supabase
            .from("community_action_edits")
            .insert({
                action_id: actionId,
                proposer_user_id: userId,
                status: "pending",
                ...proposed,
                created_at: new Date().toISOString(),
            } as any)
            .select()
            .single();

        if (insertError || !edit) {
            console.error("[public-action-lib] submit-edit insert error:", insertError);
            const message =
                (insertError as any)?.code === "42P01"
                    ? "数据库未完成迁移，请先执行 20260205_public_action_coedit.sql"
                    : "提交编辑建议失败";
            return NextResponse.json<ApiData<null>>(
                { success: false, message, data: null },
                { status: 500 },
            );
        }

        return NextResponse.json<ApiData<SubmitPublicActionEditResponseDto>>({
            success: true,
            message: "已提交编辑建议，等待上传者审核",
            data: { edit },
        });
    } catch (e) {
        console.error("[public-action-lib] submit-edit unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

