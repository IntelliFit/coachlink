import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    SyncPublicActionToMyLibDto,
    SyncPublicActionToMyLibResponseDto,
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

        const { actionId, targetActionType = "student" } =
            (await req.json()) as SyncPublicActionToMyLibDto;
        if (!actionId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 actionId", data: null },
                { status: 400 },
            );
        }

        const { data: publicAction, error: fetchError } = await supabase
            .from("community_actions")
            .select("*")
            .eq("id", actionId)
            .single();

        if (fetchError || !publicAction) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "公共动作不存在", data: null },
                { status: 404 },
            );
        }

        if ((publicAction as any).owner_user_id !== userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "仅上传者可同步到本地动作库", data: null },
                { status: 403 },
            );
        }

        const targetTable =
            targetActionType === "coach" ? "coach_actions" : "student_actions";
        const ownerColumn = targetActionType === "coach" ? "coach_id" : "user_id";

        const payload: any = {
            [ownerColumn]: userId,
            name: (publicAction as any).name,
            detail: (publicAction as any).detail,
            positions: (publicAction as any).positions,
            attrs: (publicAction as any).attrs,
            url: (publicAction as any).url,
            type: (publicAction as any).type,
            item_schema: (publicAction as any).item_schema,
            suggested_time: (publicAction as any).suggested_time,
            enableAutoWeightCompute: (publicAction as any).enableAutoWeightCompute,
            includesBodyWeight: (publicAction as any).includesBodyWeight,
            canonical_action_id: (publicAction as any).canonical_action_id,
            updated_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
            .from(targetTable)
            .select("id")
            .eq(ownerColumn, userId)
            .eq("name", (publicAction as any).name)
            .maybeSingle();

        if (existing?.id) {
            const { data: updated, error: updateError } = await supabase
                .from(targetTable)
                .update(payload)
                .eq("id", existing.id)
                .select()
                .single();
            if (updateError || !updated) {
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: "同步失败", data: null },
                    { status: 500 },
                );
            }
            return NextResponse.json<ApiData<SyncPublicActionToMyLibResponseDto>>({
                success: true,
                message: "已覆盖本地同名动作",
                data: { action: updated },
            });
        }

        const { data: created, error: insertError } = await supabase
            .from(targetTable)
            .insert({ ...payload, created_at: new Date().toISOString() })
            .select()
            .single();

        if (insertError || !created) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "同步失败", data: null },
                { status: 500 },
            );
        }

        return NextResponse.json<ApiData<SyncPublicActionToMyLibResponseDto>>({
            success: true,
            message: "已同步到本地动作库",
            data: { action: created },
        });
    } catch (e) {
        console.error("[public-action-lib] sync-to-my-lib unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

