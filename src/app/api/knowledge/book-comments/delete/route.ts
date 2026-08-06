import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { isMissingBookCommentsTable, isUuid } from "../_helpers";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
  }
  const payload = await req.json().catch(() => ({})) as { commentId?: string };
  if (!isUuid(payload.commentId)) {
    return NextResponse.json({ success: false, message: "评论 ID 无效", data: null }, { status: 400 });
  }

  try {
    const { data: comment, error: findError } = await serviceRoleSupabase
      .from("knowledge_book_comments")
      .select("id, user_id")
      .eq("id", payload.commentId)
      .maybeSingle();
    if (findError) throw findError;
    if (!comment) {
      return NextResponse.json({ success: false, message: "评论不存在", data: null }, { status: 404 });
    }
    if (comment.user_id !== session.user.id) {
      return NextResponse.json({ success: false, message: "只能删除自己的评论", data: null }, { status: 403 });
    }

    const { error } = await serviceRoleSupabase
      .from("knowledge_book_comments")
      .update({ status: "deleted", body: "该评论已删除" })
      .eq("id", comment.id);
    if (error) throw error;

    return NextResponse.json<ApiData<{ commentId: string }>>({
      success: true,
      message: "评论已删除",
      data: { commentId: comment.id },
    });
  } catch (error) {
    console.error("删除书籍讨论失败:", error);
    const missingTable = isMissingBookCommentsTable(error);
    return NextResponse.json({
      success: false,
      message: missingTable ? "讨论区数据库迁移尚未执行" : "删除评论失败",
      data: null,
    }, { status: missingTable ? 503 : 500 });
  }
}
