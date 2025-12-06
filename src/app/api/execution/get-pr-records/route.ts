import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";

interface PRRecord {
    id: string;
    exercise_name: string;
    max_weight: number;
    max_reps: number;
    load_formula: string;
    date_achieved: string;
    notes?: string;
    video_url?: string;
    action_id?: string;
    execution_id?: string;
    created_at: string;
}

interface GetPRRecordsResponse {
    success: boolean;
    message?: string;
    data?: {
        records: PRRecord[];
        total: number;
    };
}

/**
 * GET /api/execution/get-pr-records
 *
 * Fetches user's personal record history
 * Query params:
 *   - userId: Optional, for coaches to view their student's records
 *   - limit: Max records to return (default 20)
 *   - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<GetPRRecordsResponse>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(request.url);
        const requestedUserId = searchParams.get("userId");
        const limit = parseInt(searchParams.get("limit") || "20");
        const offset = parseInt(searchParams.get("offset") || "0");

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
                return NextResponse.json<GetPRRecordsResponse>(
                    { success: false, message: "无权查看该用户的记录" },
                    { status: 403 },
                );
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
                return NextResponse.json<GetPRRecordsResponse>(
                    { success: false, message: "该学员不在您的订阅列表中" },
                    { status: 403 },
                );
            }

            targetUserId = requestedUserId;
        }

        // Get PR records from personal_records_history
        const { data: records, error, count } = await supabase
            .from("personal_records_history")
            .select("*", { count: "exact" })
            .eq("user_id", targetUserId)
            .order("date_achieved", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error("获取PR记录失败:", error);
            return NextResponse.json<GetPRRecordsResponse>(
                { success: false, message: "获取记录失败" },
                { status: 500 },
            );
        }

        const prRecords: PRRecord[] = (records || []).map((r) => ({
            id: r.id,
            exercise_name: r.exercise_name,
            max_weight: r.max_weight,
            max_reps: r.max_reps,
            load_formula: r.load_formula,
            date_achieved: r.date_achieved,
            notes: r.notes,
            video_url: r.video_url,
            action_id: r.action_id,
            execution_id: r.execution_id,
            created_at: r.created_at,
        }));

        return NextResponse.json<GetPRRecordsResponse>({
            success: true,
            data: {
                records: prRecords,
                total: count || 0,
            },
        });
    } catch (error) {
        console.error("获取PR记录失败:", error);
        return NextResponse.json<GetPRRecordsResponse>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
