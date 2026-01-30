import { NextRequest, NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

export type PublicArticleDetailResponseDto = ApiData<{
    id: string;
    coachId: string;
    coachName: string;
    coachAvatarUrl: string | null;
    title: string;
    contentType: string;
    requiredTier: number;
    publishedAt: string | null;
    // 未登录/未订阅场景可能仅返回预览
    content: string;
    isPreview: boolean;
}>;

function stripHtml(input: string) {
    return (input || "").replace(/<[^>]*>/g, "").trim();
}

function previewText(input: string, maxChars = 900) {
    const txt = stripHtml(input);
    if (txt.length <= maxChars) return txt;
    return txt.slice(0, maxChars).trimEnd() + "…";
}

/**
 * GET /api/public/articles/get?id={uuid}
 *
 * 公开访问：仅用于兼容（不提供详情阅读）。
 * 说明：根据产品规则，文章详情需登录后访问，请使用 /api/articles/get。
 */
export async function GET(req: NextRequest) {
    return NextResponse.json<PublicArticleDetailResponseDto>(
        { success: false, message: "请先登录查看文章详情", data: null },
        { status: 401 },
    );
}

// Legacy implementation kept below for reference (disabled by early return).
export async function __LEGACY_DISABLED_GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) {
        return NextResponse.json<PublicArticleDetailResponseDto>(
            { success: false, message: "缺少 id", data: null },
            { status: 400 },
        );
    }

    const { data, error } = await serviceRoleSupabase
        .from("coach_contents")
        .select(
            `
            id,
            coach_id,
            title,
            content,
            content_type,
            required_tier,
            created_at,
            coach:coaches(
                id,
                name,
                avatar_url,
                status
            )
        `,
        )
        .eq("id", id)
        .maybeSingle();

    if (error || !data) {
        return NextResponse.json<PublicArticleDetailResponseDto>(
            { success: false, message: "文章不存在", data: null },
            { status: 404 },
        );
    }

    if ((data as any)?.coach?.status !== "approved") {
        return NextResponse.json<PublicArticleDetailResponseDto>(
            { success: false, message: "文章不可见", data: null },
            { status: 404 },
        );
    }

    const requiredTier = Number((data as any).required_tier ?? 0);
    const rawContent = String((data as any).content || "");
    const isPreview = requiredTier > 0;

    return NextResponse.json<PublicArticleDetailResponseDto>({
        success: true,
        message: "获取成功",
        data: {
            id: (data as any).id,
            coachId: (data as any).coach_id,
            coachName: (data as any).coach?.name || "教练",
            coachAvatarUrl: (data as any).coach?.avatar_url ?? null,
            title: (data as any).title || "未命名",
            contentType: (data as any).content_type || "text",
            requiredTier,
            publishedAt: (data as any).created_at ?? null,
            content: isPreview ? previewText(rawContent) : stripHtml(rawContent),
            isPreview,
        },
    });
}

