import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { ListKnowledgeBookCommentsResponse } from "@/types/knowledgeBookDiscussion";
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

  const body = await req.json().catch(() => ({})) as {
    bookId?: string;
    limit?: number;
    offset?: number;
  };
  if (!isUuid(body.bookId)) {
    return NextResponse.json({ success: false, message: "书籍 ID 无效", data: null }, { status: 400 });
  }

  try {
    if (!await userCanReadBook(session.user.id, body.bookId)) {
      return NextResponse.json({ success: false, message: "无权查看该书讨论", data: null }, { status: 403 });
    }

    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
    const offset = Math.max(Number(body.offset) || 0, 0);
    const { data, count, error } = await serviceRoleSupabase
      .from("knowledge_book_comments")
      .select("*", { count: "exact" })
      .eq("book_id", body.bookId)
      .eq("status", "visible")
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      if (isMissingBookCommentsTable(error)) {
        return NextResponse.json<ApiData<ListKnowledgeBookCommentsResponse>>({
          success: true,
          message: "讨论区数据库迁移尚未执行",
          data: { comments: [], total: 0, limit, offset, available: false },
        });
      }
      throw error;
    }

    return NextResponse.json<ApiData<ListKnowledgeBookCommentsResponse>>({
      success: true,
      message: "获取书籍讨论成功",
      data: {
        comments: await enrichBookComments(data || [], session.user.id),
        total: count || 0,
        limit,
        offset,
        available: true,
      },
    });
  } catch (error) {
    console.error("获取书籍讨论失败:", error);
    return NextResponse.json({ success: false, message: "获取书籍讨论失败", data: null }, { status: 500 });
  }
}
