import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

import type { ApiData } from "@/types/api";
import type {
    PublishFromMyActionDto,
    PublishFromMyActionResponseDto,
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

        const { actionType, actionId } = (await req.json()) as PublishFromMyActionDto;
        if (!actionType || !actionId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 actionType 或 actionId", data: null },
                { status: 400 },
            );
        }

        const tableName = actionType === "student" ? "student_actions" : "coach_actions";
        const ownerColumn = actionType === "student" ? "user_id" : "coach_id"; // coach_actions.coach_id 关联的是 users.id

        const { data: myAction, error: fetchError } = await supabase
            .from(tableName)
            .select("*")
            .eq("id", actionId)
            .eq(ownerColumn, userId)
            .single();

        if (fetchError || !myAction) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "动作不存在或无权限", data: null },
                { status: 404 },
            );
        }
        if (!(myAction as any).url || !(myAction as any).url.trim()) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "演示视频链接必填", data: null },
                { status: 400 },
            );
        }

        const insertData: any = {
            contributor_user_id: userId,
            owner_user_id: userId,
            name: (myAction as any).name,
            detail: (myAction as any).detail ?? null,
            positions: (myAction as any).positions ?? null,
            attrs: (myAction as any).attrs ?? null,
            url: (myAction as any).url ?? null,
            type: (myAction as any).type ?? "STRENGTH",
            item_schema: (myAction as any).item_schema ?? null,
            suggested_time: (myAction as any).suggested_time ?? null,
            enableAutoWeightCompute: (myAction as any).enableAutoWeightCompute ?? false,
            includesBodyWeight: (myAction as any).includesBodyWeight ?? false,
            canonical_action_id: (myAction as any).canonical_action_id ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { data: publicAction, error: insertError } = await supabase
            .from("community_actions")
            .insert(insertData)
            .select()
            .single();

        if (insertError) {
            // 唯一约束：unique_community_action_name (contributor_user_id, name)
            if ((insertError as any)?.code === "23505") {
                // 幂等 + 允许更新：如果已存在则覆盖更新公共动作（不影响已复制到个人库的旧版本）
                const { data: existing, error: existingError } = await supabase
                    .from("community_actions")
                    .select("*")
                    .eq("contributor_user_id", userId)
                    .eq("name", (myAction as any).name)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                if (existingError || !existing) {
                    return NextResponse.json<ApiData<null>>(
                        { success: false, message: "您已贡献过同名公共动作", data: null },
                        { status: 409 },
                    );
                }

                const { data: updated, error: updateError } = await supabase
                    .from("community_actions")
                    .update({
                        detail: insertData.detail,
                        positions: insertData.positions,
                        attrs: insertData.attrs,
                        url: insertData.url,
                        type: insertData.type,
                        item_schema: insertData.item_schema,
                        suggested_time: insertData.suggested_time,
                        enableAutoWeightCompute: insertData.enableAutoWeightCompute,
                        includesBodyWeight: insertData.includesBodyWeight,
                        canonical_action_id: insertData.canonical_action_id,
                        updated_at: new Date().toISOString(),
                    } as any)
                    .eq("id", (existing as any).id)
                    .select()
                    .single();

                if (updateError || !updated) {
                    console.error(
                        "[public-action-lib] publish-from-my-action update-on-conflict error:",
                        updateError,
                    );
                    return NextResponse.json<ApiData<null>>(
                        { success: false, message: "更新公共动作失败", data: null },
                        { status: 500 },
                    );
                }

                await incrementContributor({
                    supabase,
                    actionId: (existing as any).id,
                    userId,
                    role: "owner",
                });

                return NextResponse.json<ApiData<PublishFromMyActionResponseDto>>({
                    success: true,
                    message: "已更新公共动作库版本",
                    data: { publicAction: updated },
                });
            }
            console.error("[public-action-lib] publish-from-my-action insert error:", insertError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "贡献失败", data: null },
                { status: 500 },
            );
        }

        if (publicAction?.id) {
            await incrementContributor({
                supabase,
                actionId: publicAction.id,
                userId,
                role: "owner",
            });
        }

        return NextResponse.json<ApiData<PublishFromMyActionResponseDto>>({
            success: true,
            message: "已成功贡献到公共动作库",
            data: { publicAction },
        });
    } catch (e) {
        console.error("[public-action-lib] publish-from-my-action unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

async function incrementContributor(params: {
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

