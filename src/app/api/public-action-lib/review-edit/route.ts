import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    ReviewPublicActionEditDto,
    ReviewPublicActionEditResponseDto,
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

        const { actionId, editId, decision, reviewNote } =
            (await req.json()) as ReviewPublicActionEditDto;
        if (!actionId || !editId || !decision) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 actionId / editId / decision", data: null },
                { status: 400 },
            );
        }

        const { data: action, error: actionError } = await supabase
            .from("community_actions")
            .select("*")
            .eq("id", actionId)
            .single();

        if (actionError || !action) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "公共动作不存在", data: null },
                { status: 404 },
            );
        }

        if (action.owner_user_id !== userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "无权限审核该动作", data: null },
                { status: 403 },
            );
        }

        const { data: edit, error: editError } = await supabase
            .from("community_action_edits")
            .select("*")
            .eq("id", editId)
            .eq("action_id", actionId)
            .single();

        if (editError || !edit) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "编辑提案不存在", data: null },
                { status: 404 },
            );
        }

        if (edit.status !== "pending") {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "该提案已审核", data: null },
                { status: 409 },
            );
        }

        const now = new Date().toISOString();

        if (decision === "approve") {
            const effectiveUrl = edit.proposed_url ?? action.url;
            if (!effectiveUrl || !String(effectiveUrl).trim()) {
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: "演示视频链接必填", data: null },
                    { status: 400 },
                );
            }
            const { data: updatedAction, error: updateActionError } = await supabase
                .from("community_actions")
                .update({
                    name: edit.proposed_name ?? action.name,
                    detail: edit.proposed_detail ?? action.detail,
                    positions: edit.proposed_positions ?? action.positions,
                    attrs: edit.proposed_attrs ?? action.attrs,
                    url: effectiveUrl,
                    type: edit.proposed_type ?? action.type,
                    item_schema: edit.proposed_item_schema ?? action.item_schema,
                    suggested_time: edit.proposed_suggested_time ?? action.suggested_time,
                    enableAutoWeightCompute:
                        edit.proposed_enableAutoWeightCompute ??
                        action.enableAutoWeightCompute,
                    includesBodyWeight:
                        edit.proposed_includesBodyWeight ?? action.includesBodyWeight,
                    canonical_action_id:
                        edit.proposed_canonical_action_id ?? action.canonical_action_id,
                    last_approved_edit_id: edit.id,
                    updated_at: now,
                } as any)
                .eq("id", actionId)
                .select()
                .single();

            if (updateActionError || !updatedAction) {
                console.error(
                    "[public-action-lib] review-edit update action error:",
                    updateActionError,
                );
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: "更新公共动作失败", data: null },
                    { status: 500 },
                );
            }

            const { data: updatedEdit, error: updateEditError } = await supabase
                .from("community_action_edits")
                .update({
                    status: "approved",
                    reviewer_user_id: userId,
                    reviewed_at: now,
                    review_note: reviewNote ?? null,
                })
                .eq("id", editId)
                .select()
                .single();

            if (updateEditError || !updatedEdit) {
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: "更新编辑提案失败", data: null },
                    { status: 500 },
                );
            }

            await upsertContributor({
                supabase,
                actionId,
                userId: edit.proposer_user_id,
                role: "editor",
            });

            return NextResponse.json<ApiData<ReviewPublicActionEditResponseDto>>({
                success: true,
                message: "已通过并更新公共动作",
                data: { action: updatedAction, edit: updatedEdit },
            });
        }

        const { data: rejectedEdit, error: rejectError } = await supabase
            .from("community_action_edits")
            .update({
                status: "rejected",
                reviewer_user_id: userId,
                reviewed_at: now,
                review_note: reviewNote ?? null,
            })
            .eq("id", editId)
            .select()
            .single();

        if (rejectError || !rejectedEdit) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "更新编辑提案失败", data: null },
                { status: 500 },
            );
        }

        return NextResponse.json<ApiData<ReviewPublicActionEditResponseDto>>({
            success: true,
            message: "已驳回编辑提案",
            data: { action, edit: rejectedEdit },
        });
    } catch (e) {
        console.error("[public-action-lib] review-edit unexpected:", e);
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

