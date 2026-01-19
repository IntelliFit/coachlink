import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";

type DeletePRRecordDto = {
  recordId: string;
};

/**
 * POST /api/execution/delete-pr-record
 *
 * Deletes a personal_records_history row.
 * Allowed:
 * - The owner (student) themselves
 * - The student's active coach
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
    }

    const body = (await request.json()) as DeletePRRecordDto;
    if (!body?.recordId) {
      return NextResponse.json({ success: false, message: "缺少 recordId" }, { status: 400 });
    }

    // Fetch record owner + linkage fields (for cascade delete of AUTO_STATE)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: record, error: recErr } = await (supabase as any)
      .from("personal_records_history")
      .select("id, user_id, action_id, execution_id, execution_set_number, notes")
      .eq("id", body.recordId)
      .maybeSingle();

    if (recErr) {
      return NextResponse.json({ success: false, message: "查询记录失败" }, { status: 500 });
    }
    if (!record?.id || !record.user_id) {
      return NextResponse.json({ success: false, message: "记录不存在" }, { status: 404 });
    }

    const requesterId = session.user.id;
    const targetUserId = record.user_id as string;

    // Owner can delete
    if (targetUserId !== requesterId) {
      // Otherwise must be coach of the student
      const { data: coachRow } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", requesterId)
        .maybeSingle();

      if (!coachRow?.id) {
        return NextResponse.json({ success: false, message: "无权删除该记录" }, { status: 403 });
      }

      const { data: subscription } = await supabase
        .from("coach_subscriptions")
        .select("id")
        .eq("coach_id", coachRow.id)
        .eq("student_id", targetUserId)
        .eq("status", "active")
        .maybeSingle();

      if (!subscription) {
        return NextResponse.json({ success: false, message: "无权删除该记录" }, { status: 403 });
      }
    }

    // Delete the selected record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delErr } = await (supabase as any)
      .from("personal_records_history")
      .delete()
      .eq("id", body.recordId);

    if (delErr) {
      console.error("[delete-pr-record] Failed:", delErr);
      return NextResponse.json({ success: false, message: "删除失败" }, { status: 500 });
    }

    // Best-effort: also delete the matching AUTO_STATE snapshot from the same set
    // so deleting a wrong PR immediately removes its impact on "current 1RM".
    if (record?.user_id && record?.action_id && record?.execution_id && record?.execution_set_number != null) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("personal_records_history")
          .delete()
          .eq("user_id", record.user_id)
          .eq("action_id", record.action_id)
          .eq("execution_id", record.execution_id)
          .eq("execution_set_number", record.execution_set_number)
          .eq("notes", "AUTO_STATE");
      } catch (e) {
        console.warn("[delete-pr-record] Cascade delete AUTO_STATE failed:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[delete-pr-record] Error:", e);
    return NextResponse.json({ success: false, message: "服务器错误" }, { status: 500 });
  }
}

