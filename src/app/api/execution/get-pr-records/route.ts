import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    GetPRRecordsDto,
    GetPRRecordsResponseDto,
    PRRecord,
} from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;

    const {
        userId: requestedUserId,
        limit = 20,
        offset = 0,
    } = await req.json() as GetPRRecordsDto;

    let targetUserId = userId;

    // If userId is provided, verify the requester is a coach of this student
    if (requestedUserId && requestedUserId !== userId) {
        // Find coach record for current user
        const { data: coachRow } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

        if (!coachRow?.id) {
            return NextResponse.json({
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
            return NextResponse.json({
                success: false,
                message: "该学员不在您的订阅列表中",
                data: null,
            }, { status: 403 });
        }

        targetUserId = requestedUserId;
    }

    // Get PR records using new column names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: records, error, count } = await (supabase as any)
        .from("personal_records_history")
        .select("*", { count: "exact" })
        .eq("user_id", targetUserId)
        .order("date_achieved", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error("获取PR记录失败:", error);
        return NextResponse.json({
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

    // 重点！必须申请接口范型为 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetPRRecordsResponseDto>>({
        success: true,
        message: "获取记录成功",
        // GetPRRecordsResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            records: prRecords,
            total: count || 0,
        },
    });
}

