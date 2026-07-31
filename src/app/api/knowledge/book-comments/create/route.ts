import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { KnowledgeBookDiscussionComment } from "@/types/knowledgeBookDiscussion";
import {
  enrichBookComments,
  isMissingBookCommentsTable,
  isUuid,
  userCanReadBook,
} from "../_helpers";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({})) as {
    bookId?: string;
    parentId?: string | null;
    body?: string;
  };
  const commentBody = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!isUuid(payload.bookId)) {
    return NextResponse.json({ success: false, message: "书籍 ID 无效", data: null }, { status: 400 });
  }
  if (payload.parentId && !isUuid(payload.parentId)) {
    return NextResponse.json({ success: false, message: "回复对象无效", data: null }, { status: 400 });
  }
  if (commentBody.length < 1 || commentBody.length > 2000) {
    return NextResponse.json({ success: false, message: "评论需为 1—2000 个字符", data: null }, { status: 400 });
  }

  try {
    if (!await userCanReadBook(session.user.id, payload.bookId)) {
      return NextResponse.json({ success: false, message: "无权参与该书讨论", data: null }, { status: 403 });
    }

    if (payload.parentId) {
      const { data: parent, error: parentError } = await serviceRoleSupabase
        .from("knowledge_book_comments")
        .select("id, book_id, status")
        .eq("id", payload.parentId)
        .maybeSingle();
      if (parentError) throw parentError;
      if (!parent || parent.book_id !== payload.bookId || parent.status !== "visible") {
        return NextResponse.json({ success: false, message: "回复对象不存在", data: null }, { status: 404 });
      }
    }

    const { data, error } = await serviceRoleSupabase
      .from("knowledge_book_comments")
      .insert({
        book_id: payload.bookId,
        user_id: session.user.id,
        parent_id: payload.parentId || null,
        body: commentBody,
      })
      .select("*")
      .single();
    if (error) throw error;

    const [comment] = await enrichBookComments([data], session.user.id);
    return NextResponse.json<ApiData<{ comment: KnowledgeBookDiscussionComment }>>({
      success: true,
      message: payload.parentId ? "回复已发布" : "评论已发布",
      data: { comment },
    });
  } catch (error) {
    console.error("发布书籍讨论失败:", error);
    const missingTable = isMissingBookCommentsTable(error);
    return NextResponse.json({
      success: false,
      message: missingTable ? "讨论区数据库迁移尚未执行" : "发布讨论失败",
      data: null,
    }, { status: missingTable ? 503 : 500 });
  }
}
