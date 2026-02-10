import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    ListPublicActionContributorsDto,
    ListPublicActionContributorsResponseDto,
    PublicActionContributorItemDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const { actionId } = (await req.json()) as ListPublicActionContributorsDto;
        if (!actionId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少 actionId", data: null },
                { status: 400 },
            );
        }

        const { data: rows, error } = await supabase
            .from("community_action_contributors")
            .select("action_id, user_id, role, contribution_count, last_contributed_at")
            .eq("action_id", actionId)
            .order("contribution_count", { ascending: false })
            .order("last_contributed_at", { ascending: false });

        if (error) {
            console.error("[public-action-lib] list-contributors error:", error);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "获取贡献者失败", data: null },
                { status: 500 },
            );
        }

        const items = (rows || []) as any[];
        const userIds = Array.from(
            new Set(items.map((x) => x.user_id).filter(Boolean)),
        );

        const userMap = new Map<string, { nickname: string | null; avatarUrl: string | null }>();
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from("user_profiles")
                .select("user_id, nickname, avatar_url")
                .in("user_id", userIds);
            for (const p of profiles || []) {
                userMap.set(p.user_id, {
                    nickname: p.nickname ?? null,
                    avatarUrl: p.avatar_url ?? null,
                });
            }
        }

        const contributors: PublicActionContributorItemDto[] = items.map((c) => ({
            userId: c.user_id,
            nickname: userMap.get(c.user_id)?.nickname ?? null,
            avatarUrl: userMap.get(c.user_id)?.avatarUrl ?? null,
            role: c.role ?? null,
            contribution_count: Number(c.contribution_count || 0),
            last_contributed_at: c.last_contributed_at ?? null,
        }));

        return NextResponse.json<ApiData<ListPublicActionContributorsResponseDto>>({
            success: true,
            message: "获取成功",
            data: { contributors },
        });
    } catch (e) {
        console.error("[public-action-lib] list-contributors unexpected:", e);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

