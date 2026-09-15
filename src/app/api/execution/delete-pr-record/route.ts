import { NextResponse } from "next/server";
import { getApiUserId } from "@/lib/getApiUserId";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    DeletePRRecordDto,
    DeletePRRecordResponseDto,
} from "./entity";

/**
 * POST /api/execution/delete-pr-record
 *
 * Deletes a personal_records_history row.
 * Allowed:
 * - The owner (student) themselves
 * - The student's active coach
 */
export async function POST(req: Request) {
  try {
    const requesterId = await getApiUserId(req);
    if (!requesterId) {
      return NextResponse.json<ApiData<DeletePRRecordResponseDto>>({
        success: false,
        message: "未登录",
        data: null,
      }, { status: 401 });
    }

    const body = (await req.json()) as DeletePRRecordDto;
    if (!body?.recordId) {
      return NextResponse.json<ApiData<DeletePRRecordResponseDto>>({
        success: false,
        message: "缺少 recordId",
        data: null,
      }, { status: 400 });
    }

    // Fetch record owner + linkage fields (for cascade delete of AUTO_STATE)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: record, error: recErr } = await (supabase as any)
      .from("personal_records_history")
      .select("id, user_id, action_id, execution_id, execution_set_number, notes")
      .eq("id", body.recordId)
      .maybeSingle();

    if (recErr) {
      return NextResponse.json<ApiData<DeletePRRecordResponseDto>>({
        success: false,
        message: "查询记录失败",
        data: null,
      }, { status: 500 });
    }
    if (!record?.id || !record.user_id) {
      return NextResponse.json<ApiData<DeletePRRecordResponseDto>>({
        success: false,
        message: "记录不存在",
        data: null,
      }, { status: 404 });
    }

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
        return NextResponse.json<ApiData<DeletePRRecordResponseDto>>({
          success: false,
          message: "无权删除该记录",
          data: null,
        }, { status: 403 });
      }

      const { data: subscription } = await supabase
        .from("coach_subscriptions")
        .select("id")
        .eq("coach_id", coachRow.id)
        .eq("student_id", targetUserId)
        .eq("status", "active")
        .maybeSingle();

      if (!subscription) {
        return NextResponse.json<ApiData<DeletePRRecordResponseDto>>({
          success: false,
          message: "无权删除该记录",
          data: null,
        }, { status: 403 });
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
      return NextResponse.json<ApiData<DeletePRRecordResponseDto>>({
        success: false,
        message: "删除失败",
        data: null,
      }, { status: 500 });
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

    return NextResponse.json<ApiData<DeletePRRecordResponseDto>>({
      success: true,
      message: "删除成功",
      data: null,
    });
  } catch (e) {
    console.error("[delete-pr-record] Error:", e);
    return NextResponse.json<ApiData<DeletePRRecordResponseDto>>({
      success: false,
      message: "服务器错误",
      data: null,
    }, { status: 500 });
  }
}

