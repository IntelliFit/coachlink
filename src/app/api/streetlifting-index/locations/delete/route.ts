import { after, NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { rebuildStreetliftingLocationContributorStats } from "../contributorStats";

import type { ApiData } from "@/types/api";

export interface StreetliftingDeleteLocationResponseDto {
    id: string;
}

function fail(message: string, status: number) {
    return NextResponse.json<ApiData<StreetliftingDeleteLocationResponseDto>>({ success: false, message, data: null }, { status });
}

// Anyone may correct a point, but only its uploader may remove it (duplicates / wrong uploads).
// Points without an owning account (legacy anonymous uploads) cannot be deleted here.
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const userId = String(session?.user?.id || "").trim();
        if (!userId) return fail("请先登录后再删除点位", 401);

        const body = (await req.json().catch(() => ({}))) as { id?: unknown };
        const id = typeof body?.id === "string" ? body.id.trim() : "";
        if (!id) return fail("缺少点位 ID", 400);

        const db = serviceRoleSupabase;
        const { data: existing, error: readError } = await db
            .from("streetlifting_locations")
            .select("id, name, contributor_user_id")
            .eq("id", id)
            .maybeSingle();

        if (readError) {
            console.error("[streetlifting-index][locations] delete read error:", readError);
            return fail("删除失败，请稍后重试", 500);
        }
        if (!existing) return fail("点位不存在或已删除", 404);
        if (existing.contributor_user_id !== userId) return fail("只能删除自己上传的点位", 403);

        // Re-check ownership in the delete itself so a concurrent ownership change cannot slip through.
        const { error: deleteError, count } = await db
            .from("streetlifting_locations")
            .delete({ count: "exact" })
            .eq("id", id)
            .eq("contributor_user_id", userId);

        if (deleteError) {
            console.error("[streetlifting-index][locations] delete error:", deleteError);
            return fail("删除失败，请稍后重试", 500);
        }
        if (!count) return fail("点位不存在或已删除", 404);

        console.info("[streetlifting-index][locations] deleted by uploader", { id, name: existing.name, userId });
        after(async () => {
            try {
                await rebuildStreetliftingLocationContributorStats();
            } catch (rebuildError) {
                console.error("[streetlifting-index][locations] contributor rebuild after delete failed:", rebuildError);
            }
        });

        return NextResponse.json<ApiData<StreetliftingDeleteLocationResponseDto>>({ success: true, message: "已删除", data: { id } });
    } catch (error) {
        console.error("[streetlifting-index][locations] delete error:", error);
        return fail("服务器异常", 500);
    }
}
