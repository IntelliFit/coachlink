import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    ListPublicActionEditsDto,
    ListPublicActionEditsResponseDto,
    PublicActionEditItemDto,
    PublicActionEditUserDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id || null;

        const { actionId, includePending = false } =
            (await req.json()) as ListPublicActionEditsDto;
        if (!actionId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 actionId", data: null },
                { status: 400 },
            );
        }

        const { data: action, error: actionError } = await supabase
            .from("community_actions")
            .select("id, owner_user_id")
            .eq("id", actionId)
            .single();

        if (actionError || !action) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "公共动作不存在", data: null },
                { status: 404 },
            );
        }

        const isOwner = !!userId && action.owner_user_id === userId;
        const canSeePending = includePending && isOwner;

        let query = supabase
            .from("community_action_edits")
            .select("*")
            .eq("action_id", actionId)
            .order("created_at", { ascending: false });

        if (!canSeePending) {
            query = query.eq("status", "approved");
        }

        const { data: edits, error: editError } = await query;
        if (editError) {
            console.error("[public-action-lib] list-edits error:", editError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "获取编辑记录失败", data: null },
                { status: 500 },
            );
        }

        const editRows = (edits || []) as any[];
        const userIds = Array.from(
            new Set(
                editRows
                    .flatMap((e) => [e.proposer_user_id, e.reviewer_user_id])
                    .filter(Boolean),
            ),
        );

        const userMap = new Map<string, PublicActionEditUserDto>();
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from("user_profiles")
                .select("user_id, nickname, avatar_url")
                .in("user_id", userIds);
            for (const p of profiles || []) {
                userMap.set(p.user_id, {
                    userId: p.user_id,
                    nickname: p.nickname ?? null,
                    avatarUrl: p.avatar_url ?? null,
                });
            }
        }

        const formatted: PublicActionEditItemDto[] = editRows.map((e) => ({
            id: e.id,
            action_id: e.action_id,
            proposer_user_id: e.proposer_user_id,
            reviewer_user_id: e.reviewer_user_id ?? null,
            status: e.status,
            proposed_name: e.proposed_name ?? null,
            proposed_detail: e.proposed_detail ?? null,
            proposed_positions: e.proposed_positions ?? null,
            proposed_attrs: e.proposed_attrs ?? null,
            proposed_url: e.proposed_url ?? null,
            proposed_type: e.proposed_type ?? null,
            proposed_item_schema: e.proposed_item_schema ?? null,
            proposed_suggested_time: e.proposed_suggested_time ?? null,
            proposed_enableAutoWeightCompute:
                e.proposed_enableAutoWeightCompute ?? null,
            proposed_includesBodyWeight: e.proposed_includesBodyWeight ?? null,
            proposed_canonical_action_id: e.proposed_canonical_action_id ?? null,
            created_at: e.created_at ?? null,
            reviewed_at: e.reviewed_at ?? null,
            review_note: e.review_note ?? null,
            proposer: userMap.get(e.proposer_user_id) || null,
            reviewer: e.reviewer_user_id
                ? userMap.get(e.reviewer_user_id) || null
                : null,
        }));

        return NextResponse.json<ApiData<ListPublicActionEditsResponseDto>>({
            success: true,
            message: "获取成功",
            data: {
                isOwner,
                edits: formatted,
            },
        });
    } catch (e) {
        console.error("[public-action-lib] list-edits unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

