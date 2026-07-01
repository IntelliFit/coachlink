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

        const hasOwn = <K extends keyof SubmitPublicActionEditDto>(key: K) =>
            Object.prototype.hasOwnProperty.call(body, key);

        const proposedName = hasOwn("name")
            ? (body.name ?? "").trim()
            : String(action.name || "");
        if (!proposedName) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "名称不能为空", data: null },
                { status: 400 },
            );
        }

        const proposedUrl = hasOwn("url")
            ? (body.url ? String(body.url).trim() : null)
            : (action.url ?? null);

        const proposed = {
            proposed_name: proposedName,
            proposed_detail: hasOwn("detail") ? (body.detail ?? null) : (action.detail ?? null),
            proposed_positions: hasOwn("positions")
                ? (body.positions ?? null)
                : (action.positions ?? null),
            proposed_attrs: hasOwn("attrs") ? (body.attrs ?? null) : (action.attrs ?? null),
            proposed_url: proposedUrl,
            proposed_type: hasOwn("type") ? (body.type ?? null) : (action.type ?? null),
            proposed_item_schema: hasOwn("item_schema")
                ? (body.item_schema ?? null)
                : (action.item_schema ?? null),
            proposed_suggested_time: hasOwn("suggested_time")
                ? (body.suggested_time ?? null)
                : (action.suggested_time ?? null),
            proposed_enableAutoWeightCompute:
                hasOwn("enableAutoWeightCompute")
                    ? (body.enableAutoWeightCompute ?? null)
                    : (action.enableAutoWeightCompute ?? false),
            proposed_includesBodyWeight:
                hasOwn("includesBodyWeight")
                    ? (body.includesBodyWeight ?? null)
                    : (action.includesBodyWeight ?? false),
            proposed_canonical_action_id:
                hasOwn("canonical_action_id")
                    ? (body.canonical_action_id ?? null)
                    : (action.canonical_action_id ?? null),
        };

        const hasChange =
            proposed.proposed_name !== (action.name ?? "") ||
            (proposed.proposed_detail ?? null) !== (action.detail ?? null) ||
            JSON.stringify(proposed.proposed_positions ?? null) !==
                JSON.stringify(action.positions ?? null) ||
            JSON.stringify(proposed.proposed_attrs ?? null) !==
                JSON.stringify(action.attrs ?? null) ||
            (proposed.proposed_url ?? null) !== (action.url ?? null) ||
            (proposed.proposed_type ?? null) !== (action.type ?? null) ||
            JSON.stringify(proposed.proposed_item_schema ?? null) !==
                JSON.stringify(action.item_schema ?? null) ||
            (proposed.proposed_suggested_time ?? null) !==
                (action.suggested_time ?? null) ||
            (proposed.proposed_enableAutoWeightCompute ?? null) !==
                (action.enableAutoWeightCompute ?? null) ||
            (proposed.proposed_includesBodyWeight ?? null) !==
                (action.includesBodyWeight ?? null) ||
            (proposed.proposed_canonical_action_id ?? null) !==
                (action.canonical_action_id ?? null);

        if (!hasChange) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "未检测到改动，请修改后再提交", data: null },
                { status: 400 },
            );
        }

        const reviewerUserId = action.owner_user_id || userId;
        const reviewedAt = new Date().toISOString();

        const { data: edit, error: insertError } = await supabase
            .from("community_action_edits")
            .insert({
                action_id: actionId,
                proposer_user_id: userId,
                reviewer_user_id: reviewerUserId,
                status: "approved",
                reviewed_at: reviewedAt,
                review_note: "auto-approved",
                ...proposed,
                created_at: reviewedAt,
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

        const { data: updatedAction, error: updateActionError } = await supabase
            .from("community_actions")
            .update({
                name: proposed.proposed_name,
                detail: proposed.proposed_detail,
                positions: proposed.proposed_positions,
                attrs: proposed.proposed_attrs,
                url: proposed.proposed_url,
                type: proposed.proposed_type,
                item_schema: proposed.proposed_item_schema,
                suggested_time: proposed.proposed_suggested_time,
                enableAutoWeightCompute: proposed.proposed_enableAutoWeightCompute,
                includesBodyWeight: proposed.proposed_includesBodyWeight,
                canonical_action_id: proposed.proposed_canonical_action_id,
                last_approved_edit_id: edit.id,
                updated_at: reviewedAt,
            } as any)
            .eq("id", actionId)
            .select()
            .single();

        if (updateActionError || !updatedAction) {
            console.error("[public-action-lib] submit-edit update action error:", updateActionError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "更新公共动作失败", data: null },
                { status: 500 },
            );
        }

        await upsertContributor({
            supabase,
            actionId,
            userId,
            role: "editor",
        });

        return NextResponse.json<ApiData<SubmitPublicActionEditResponseDto>>({
            success: true,
            message: "公共动作已直接更新",
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

async function upsertContributor(params: {
    supabase: typeof import("@/lib/supabaseClient").serviceRoleSupabase;
    actionId: string;
    userId: string;
    role: string;
}) {
    const { supabase, actionId, userId, role } = params;
    const { data: existing } = await supabase
        .from("community_action_contributors")
        .select("id, contribution_count")
        .eq("action_id", actionId)
        .eq("user_id", userId)
        .maybeSingle();

    if (existing?.id) {
        await supabase
            .from("community_action_contributors")
            .update({
                contribution_count: Number(existing.contribution_count || 0) + 1,
                last_contributed_at: new Date().toISOString(),
                role,
            })
            .eq("id", existing.id);
        return;
    }

    await supabase.from("community_action_contributors").insert({
        action_id: actionId,
        user_id: userId,
        role,
        contribution_count: 1,
        last_contributed_at: new Date().toISOString(),
    });
}

