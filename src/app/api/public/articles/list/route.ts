import { NextRequest, NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

export type PublicArticleListItem = {
    id: string;
    coachId: string;
    coachName: string;
    coachAvatarUrl: string | null;
    title: string;
    summary: string;
    contentType: string;
    requiredTier: number;
    priceCents: number;
    publishedAt: string | null;
};

export type PublicArticleListResponseDto = ApiData<{
    items: PublicArticleListItem[];
    total: number;
    limit: number;
    offset: number;
}>;

function stripHtml(input: string) {
    return (input || "").replace(/<[^>]*>/g, "").trim();
}

function summarize(input: string, maxLen = 120) {
    const txt = stripHtml(input).replace(/\s+/g, " ");
    if (txt.length <= maxLen) return txt;
    return txt.slice(0, maxLen).trimEnd() + "…";
}

/**
 * GET /api/public/articles/list?limit=20&offset=0
 *
 * 公开访问：聚合教练内容管理（coach_contents）作为“资讯/文章”展示。
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 20), 50);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    const { data, error, count } = await serviceRoleSupabase
        .from("coach_contents")
        .select(
            `
            id,
            coach_id,
            title,
            content,
            content_type,
            required_tier,
            price_cents,
            created_at,
            coach:coaches(
                id,
                name,
                avatar_url,
                status
            )
        `,
            { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error("[public/articles/list] query error:", error);
        return NextResponse.json<PublicArticleListResponseDto>(
            { success: false, message: "获取文章列表失败", data: null },
            { status: 500 },
        );
    }

    const rows = (data || []) as any[];
    const items: PublicArticleListItem[] = rows
        // 只展示已审核教练（publish-content 已限制 approved，但这里再兜底）
        .filter((r) => (r?.coach?.status || null) === "approved")
        // 公开文章页优先展示文字类（避免视频/图片导致空白体验）；如果你想混合也可以删掉这行
        .filter((r) => (r?.content_type || "") === "text")
        .map((r) => ({
            id: r.id,
            coachId: r.coach_id,
            coachName: r.coach?.name || "教练",
            coachAvatarUrl: r.coach?.avatar_url ?? null,
            title: r.title || "未命名",
            summary: summarize(r.content || ""),
            contentType: r.content_type,
            requiredTier: Number(r.required_tier ?? 0),
            priceCents: Number(r.price_cents ?? 0),
            publishedAt: r.created_at ?? null,
        }));

    return NextResponse.json<PublicArticleListResponseDto>({
        success: true,
        message: "获取成功",
        data: {
            items,
            total: count || 0,
            limit,
            offset,
        },
    });
}

