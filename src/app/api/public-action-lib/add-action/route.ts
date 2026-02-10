import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type { AddPublicActionDto, AddPublicActionResponseDto } from "./entity";

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

        const body = (await req.json()) as AddPublicActionDto;
        if (!body?.name || !body.name.trim()) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "请输入动作名称", data: null },
                { status: 400 },
            );
        }
        if (!body?.url || !body.url.trim()) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "演示视频链接必填", data: null },
                { status: 400 },
            );
        }

        const type = body.type || "STRENGTH";
        const { data: action, error } = await supabase
            .from("community_actions")
            .insert({
                contributor_user_id: userId,
                owner_user_id: userId,
                name: body.name.trim(),
                detail: body.detail ?? null,
                url: body.url ?? null,
                type,
                item_schema: (body.item_schema as unknown as any) ?? null,
                suggested_time: body.suggested_time ?? null,
                positions: type === "STRENGTH" ? (body.positions ?? null) : null,
                attrs: type === "STRENGTH" ? (body.attrs ?? null) : null,
                enableAutoWeightCompute:
                    type === "STRENGTH"
                        ? (body.enableAutoWeightCompute ?? false)
                        : false,
                includesBodyWeight:
                    type === "STRENGTH" && (body.enableAutoWeightCompute ?? false)
                        ? (body.includesBodyWeight ?? false)
                        : false,
                canonical_action_id:
                    type === "STRENGTH" ? (body.canonical_action_id ?? null) : null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as any)
            .select()
            .single();

        if (error) {
            console.error("[public-action-lib] add-action error:", error);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: `贡献动作失败: ${error.message}`, data: null },
                { status: 500 },
            );
        }

        if (action?.id) {
            const { error: contributorError } = await supabase
                .from("community_action_contributors")
                .upsert(
                    {
                        action_id: action.id,
                        user_id: userId,
                        role: "owner",
                        contribution_count: 1,
                        last_contributed_at: new Date().toISOString(),
                    },
                    { onConflict: "action_id,user_id" },
                );
            if (contributorError) {
                console.warn(
                    "[public-action-lib] add-action contributor upsert error:",
                    contributorError,
                );
            }
        }

        return NextResponse.json<ApiData<AddPublicActionResponseDto>>({
            success: true,
            message: "贡献动作成功",
            data: { action },
        });
    } catch (e) {
        console.error("[public-action-lib] add-action unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

