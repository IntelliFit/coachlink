import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetPRRecordsDto,
    GetPRRecordsResponseDto,
    PRRecord,
} from "./entity";

/**
 * POST /api/execution/get-pr-records
 *
 * Fetches user's personal record history
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<GetPRRecordsResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const body = await req.json() as GetPRRecordsDto;
        const {
            userId: requestedUserId,
            limit = 20,
            offset = 0,
            includeState = false,
        } = body;

        let targetUserId = session.user.id;

        // If userId is provided, verify the requester is a coach of this student
        if (requestedUserId && requestedUserId !== session.user.id) {
            // Find coach record for current user
            const { data: coachRow } = await supabase
                .from("coaches")
                .select("id")
                .eq("user_id", session.user.id)
                .maybeSingle();

            if (!coachRow?.id) {
                return NextResponse.json<ApiData<GetPRRecordsResponseDto>>({
                    success: false,
                    message: "无权查看该用户的记录",
                    data: null,
                }, { status: 403 });
            }

            // Verify the student is subscribed to this coach
            const { data: subscription } = await supabase
                .from("coach_subscriptions")
                .select("id")
                .eq("coach_id", coachRow.id)
                .eq("student_id", requestedUserId)
                .eq("status", "active")
                .maybeSingle();

            if (!subscription) {
                return NextResponse.json<ApiData<GetPRRecordsResponseDto>>({
                    success: false,
                    message: "该学员不在您的订阅列表中",
                    data: null,
                }, { status: 403 });
            }

            targetUserId = requestedUserId;
        }

        // Get PR records using new column names
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase as any)
            .from("personal_records_history")
            .select("*", { count: "exact" })
            .eq("user_id", targetUserId)
            .order("date_achieved", { ascending: false })
            .range(offset, offset + limit - 1);

        // Hide internal AUTO_STATE snapshots by default
        if (!includeState) {
            // IMPORTANT: `.neq()` will exclude NULLs too, so we must explicitly keep notes IS NULL.
            // Keep: notes IS NULL OR notes != 'AUTO_STATE'
            query = query.or("notes.is.null,notes.neq.AUTO_STATE");
        }

        const { data: records, error, count } = await query;

        if (error) {
            console.error("获取PR记录失败:", error);
            return NextResponse.json<ApiData<GetPRRecordsResponseDto>>({
                success: false,
                message: "获取记录失败",
                data: null,
            }, { status: 500 });
        }

        // Map to response format with new column names
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prRecords: PRRecord[] = ((records || []) as any[]).map((r) => ({
            id: r.id,
            exercise_name: r.exercise_name,
            weight: r.weight ?? r.max_weight, // Fallback for pre-migration
            reps: r.reps ?? r.max_reps, // Fallback for pre-migration
            e1rm: r.e1rm ?? r.max_weight, // Fallback: e1rm or max_weight
            load_formula: r.load_formula,
            date_achieved: r.date_achieved,
            notes: r.notes,
            video_url: r.video_url,
            action_id: r.action_id,
            execution_id: r.execution_id,
            is_auto_calculated: r.is_auto_calculated || false,
            created_at: r.created_at,
        }));

        return NextResponse.json<ApiData<GetPRRecordsResponseDto>>({
            success: true,
            message: "获取成功",
            data: {
                records: prRecords,
                total: count || 0,
            },
        });
    } catch (error) {
        console.error("获取PR记录失败:", error);
        return NextResponse.json<ApiData<GetPRRecordsResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
