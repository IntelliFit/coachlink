import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { isWechatFreeRequest } from '@/lib/wechatFreeRelease';
import type { KnowledgeBookCommentRow } from "@/types";
import type { KnowledgeBookDiscussionComment } from "@/types/knowledgeBookDiscussion";

export function isMissingBookCommentsTable(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42P01" ||
    candidate?.message?.includes("knowledge_book_comments") === true;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function userCanReadBook(userId: string, bookId: string) {
  const { data: book, error } = await serviceRoleSupabase
    .from("knowledge_books")
    .select("id, is_free, is_published")
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw error;
  if (!book || !book.is_published) return false;
  if (book.is_free || await isWechatFreeRequest()) return true;

  const { data: subscription, error: subscriptionError } = await serviceRoleSupabase
    .from("knowledge_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  return Boolean(subscription);
}

export async function enrichBookComments(
  rows: KnowledgeBookCommentRow[],
  currentUserId: string
): Promise<KnowledgeBookDiscussionComment[]> {
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const profileByUserId = new Map<string, {
    nickname: string | null;
    full_name: string | null;
    avatar_url: string | null;
  }>();

  if (userIds.length > 0) {
    const { data: profiles, error } = await serviceRoleSupabase
      .from("user_profiles")
      .select("user_id, nickname, full_name, avatar_url")
      .in("user_id", userIds);
    if (error) throw error;
    for (const profile of profiles || []) {
      profileByUserId.set(profile.user_id, profile);
    }
  }

  return rows.map((row) => {
    const profile = profileByUserId.get(row.user_id);
    return {
      id: row.id,
      bookId: row.book_id,
      userId: row.user_id,
      parentId: row.parent_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: {
        name: profile?.nickname || profile?.full_name || "CoachLink 读者",
        avatarUrl: profile?.avatar_url || null,
      },
      isMine: row.user_id === currentUserId,
    };
  });
}
