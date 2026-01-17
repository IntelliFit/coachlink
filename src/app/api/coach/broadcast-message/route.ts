import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
  BroadcastMessageDto,
  BroadcastMessageResponseDto,
  BroadcastMessageResultItem,
} from "./entity";
import pLimit from "p-limit";

async function getOrCreatePrivateChatroom(members: string[]) {
  // Note: existing codebase uses `.contains('members', members)` for 1v1 chatrooms
  const { data: existing, error: findError } = await supabase
    .from("chat_rooms")
    .select("id")
    .contains("members", members)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (existing?.id) return existing.id as string;

  const now = new Date().toISOString();
  const { data: created, error: createError } = await supabase
    .from("chat_rooms")
    .insert({
      members,
      type: "private",
      unread_members: [],
      is_archived: false,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    throw new Error(createError?.message || "创建聊天室失败");
  }

  return created.id as string;
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "用户未登录", data: null },
      { status: 401 },
    );
  }

  const coachUserId = session.user.id;
  const { sendToAll, studentUserIds, content } =
    (await req.json()) as BroadcastMessageDto;

  if (!content || !content.trim()) {
    return NextResponse.json(
      { success: false, message: "缺少通知内容", data: null },
      { status: 400 },
    );
  }

  // 1) Verify coach identity
  const { data: coachRow, error: coachErr } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", coachUserId)
    .maybeSingle();

  if (coachErr) {
    return NextResponse.json(
      { success: false, message: coachErr.message, data: null },
      { status: 500 },
    );
  }

  if (!coachRow?.id) {
    return NextResponse.json(
      { success: false, message: "未找到教练身份", data: null },
      { status: 403 },
    );
  }

  // 2) Resolve target students (users.id)
  let targetStudentUserIds: string[] = [];

  if (sendToAll) {
    const { data: subs, error: subsErr } = await supabase
      .from("coach_subscriptions")
      .select("student_id")
      .eq("coach_id", coachRow.id)
      .eq("status", "active");

    if (subsErr) {
      return NextResponse.json(
        { success: false, message: subsErr.message, data: null },
        { status: 500 },
      );
    }

    targetStudentUserIds = (subs || [])
      .map((s: any) => s.student_id)
      .filter(Boolean);
  } else {
    const unique = Array.from(new Set((studentUserIds || []).filter(Boolean)));
    if (unique.length === 0) {
      return NextResponse.json(
        { success: false, message: "请选择要发送的学员", data: null },
        { status: 400 },
      );
    }

    // Verify all selected students belong to this coach and are active
    const { data: subs, error: subsErr } = await supabase
      .from("coach_subscriptions")
      .select("student_id")
      .eq("coach_id", coachRow.id)
      .eq("status", "active")
      .in("student_id", unique);

    if (subsErr) {
      return NextResponse.json(
        { success: false, message: subsErr.message, data: null },
        { status: 500 },
      );
    }

    const allowed = new Set((subs || []).map((s: any) => s.student_id));
    const forbidden = unique.filter((id) => !allowed.has(id));
    if (forbidden.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "包含无权限或非活跃学员，无法发送",
          data: null,
        },
        { status: 403 },
      );
    }

    targetStudentUserIds = unique;
  }

  if (targetStudentUserIds.length === 0) {
    return NextResponse.json<ApiData<BroadcastMessageResponseDto>>({
      success: true,
      message: "暂无可发送对象",
      data: {
        totalTargets: 0,
        successCount: 0,
        failedCount: 0,
        results: [],
      },
    });
  }

  // 3) Broadcast (limited concurrency)
  const limit = pLimit(10);
  const now = new Date().toISOString();
  const trimmedContent = content.trim();

  const tasks = targetStudentUserIds.map((studentUserId) =>
    limit(async (): Promise<BroadcastMessageResultItem> => {
      try {
        const roomId = await getOrCreatePrivateChatroom([
          coachUserId,
          studentUserId,
        ]);

        const { data: inserted, error: insertErr } = await supabase
          .from("chat_messages")
          .insert({
            room_id: roomId,
            sender_id: coachUserId,
            message_type: "text",
            content: trimmedContent,
            created_at: now,
            content_metadata: { broadcast: true },
          } as any)
          .select("id")
          .single();

        if (insertErr || !inserted?.id) {
          throw new Error(insertErr?.message || "插入消息失败");
        }

        // Keep room preview/time in sync (unread_count is handled by DB trigger)
        const { error: updateRoomErr } = await supabase
          .from("chat_rooms")
          .update({
            last_message: trimmedContent,
            last_message_at: now,
            unread_members: [studentUserId],
            updated_at: now,
          })
          .eq("id", roomId);

        if (updateRoomErr) {
          throw new Error(updateRoomErr.message);
        }

        return { studentUserId, roomId, success: true };
      } catch (e: any) {
        return {
          studentUserId,
          success: false,
          error: e?.message || "发送失败",
        };
      }
    }),
  );

  const results = await Promise.all(tasks);
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.length - successCount;

  return NextResponse.json<ApiData<BroadcastMessageResponseDto>>({
    success: true,
    message: "发送完成",
    data: {
      totalTargets: results.length,
      successCount,
      failedCount,
      results,
    },
  });
}

