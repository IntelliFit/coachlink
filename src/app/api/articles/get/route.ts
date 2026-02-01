import { NextRequest, NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

export type ArticleDetailDto = {
  id: string;
  coachId: string;
  coachName: string;
  coachAvatarUrl: string | null;
  title: string;
  contentType: string;
  publishedAt: string | null;
  priceCents: number;
  isPaid: boolean;
  canView: boolean;
  content: string;
};

export type ArticleDetailResponseDto = ApiData<ArticleDetailDto>;

function stripHtml(input: string) {
  return (input || "").replace(/<[^>]*>/g, "").trim();
}

function previewText(input: string, maxChars = 900) {
  const txt = stripHtml(input);
  if (txt.length <= maxChars) return txt;
  return txt.slice(0, maxChars).trimEnd() + "…";
}

/**
 * GET /api/articles/get?id={uuid}
 *
 * 登录态访问：免费文章返回全文；付费文章根据是否已购返回全文或预览。
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json<ArticleDetailResponseDto>(
      { success: false, message: "用户未登录", data: null },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  if (!id) {
    return NextResponse.json<ArticleDetailResponseDto>(
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
        price_cents,
        created_at,
        coach:coaches(id,name,avatar_url,status)
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json<ArticleDetailResponseDto>(
      { success: false, message: "文章不存在", data: null },
      { status: 404 },
    );
  }
  if ((data as any)?.coach?.status !== "approved") {
    return NextResponse.json<ArticleDetailResponseDto>(
      { success: false, message: "文章不可见", data: null },
      { status: 404 },
    );
  }

  const priceCents = Number((data as any).price_cents ?? 0);
  const isPaid = priceCents > 0;
  const requiredTier = Number((data as any).required_tier ?? 0);

  let purchased = false;
  if (isPaid) {
    const { data: purchase } = await serviceRoleSupabase
      .from("content_purchases" as any)
      .select("id,status")
      .eq("content_id", id)
      .eq("user_id", session.user.id)
      .eq("status", "paid")
      .maybeSingle();
    purchased = !!purchase;
  }

  let subscriptionUnlocked = false;
  if (isPaid) {
    try {
      const coachId = String((data as any).coach_id || "");
      if (coachId) {
        const { data: sub } = await serviceRoleSupabase
          .from("coach_subscriptions")
          .select("id,tier,status")
          .eq("coach_id", coachId)
          .eq("student_id", session.user.id)
          .eq("status", "active")
          .gte("tier", requiredTier)
          .maybeSingle();
        subscriptionUnlocked = !!sub;
      }
    } catch {
      // ignore
    }
  }

  const canView = !isPaid || purchased || subscriptionUnlocked;
  const raw = String((data as any).content || "");

  return NextResponse.json<ArticleDetailResponseDto>({
    success: true,
    message: "获取成功",
    data: {
      id: (data as any).id,
      coachId: (data as any).coach_id,
      coachName: (data as any).coach?.name || "教练",
      coachAvatarUrl: (data as any).coach?.avatar_url ?? null,
      title: (data as any).title || "未命名",
      contentType: (data as any).content_type || "text",
      publishedAt: (data as any).created_at ?? null,
      priceCents,
      isPaid,
      canView,
      content: canView ? stripHtml(raw) : previewText(raw),
    },
  });
}

