import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getAuthUser } from "@/lib/auth";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    GetPRRecordsDto,
    GetPRRecordsResponseDto,
    PRRecord,
} from "./entity";
import { PR_THRESHOLD_KG } from "@/lib/e1rmCalculator";

export async function POST(req: Request) {
    const authResult = await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = authResult.userId;

    const {
        userId: requestedUserId,
        limit = 20,
        offset = 0,
        includeState = false,
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

    // Load records first, then apply strict PR filtering in-memory.
    // This ensures timeline semantics remain stable:
    // - Curve can use rich sources
    // - Timeline only shows real breakthroughs (PR + 2kg)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: records, error } = await (supabase as any)
        .from("personal_records_history")
        .select("id, exercise_name, weight, reps, e1rm, load_formula, date_achieved, notes, video_url, action_id, execution_id, is_auto_calculated, created_at")
        .eq("user_id", targetUserId)
        .order("date_achieved", { ascending: true })
        .order("created_at", { ascending: true });

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
    const mappedRecords: PRRecord[] = ((records || []) as any[]).map((r) => ({
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

    const sourceRecords = includeState
        ? mappedRecords
        : mappedRecords.filter((r) => r.notes !== "AUTO_STATE");

    let timelineRecords: PRRecord[] = sourceRecords;
    if (!includeState) {
        // Strict timeline rule:
        // a record is shown only when it beats the previous PR peak by > 2kg.
        const runningPRMaxByAction = new Map<string, number>();
        const qualified: PRRecord[] = [];

        for (const record of sourceRecords) {
            const current = Number(record.e1rm || 0);
            if (!Number.isFinite(current) || current <= 0) continue;

            const actionKey = String(record.action_id || record.exercise_name || "").trim();
            if (!actionKey) continue;

            const prev = runningPRMaxByAction.get(actionKey);
            if (prev === undefined) {
                // Keep the first positive record as baseline PR.
                runningPRMaxByAction.set(actionKey, current);
                qualified.push(record);
                continue;
            }

            if ((current - prev) > PR_THRESHOLD_KG) {
                runningPRMaxByAction.set(actionKey, current);
                qualified.push(record);
            }
        }

        timelineRecords = qualified;
    }

    const sortedForTimeline = [...timelineRecords].sort((a, b) => {
        const aTime = new Date(`${a.date_achieved || ""}T00:00:00`).getTime() || new Date(a.created_at || 0).getTime();
        const bTime = new Date(`${b.date_achieved || ""}T00:00:00`).getTime() || new Date(b.created_at || 0).getTime();
        return bTime - aTime;
    });
    const pagedRecords = sortedForTimeline.slice(offset, offset + limit);

    // 重点！必须申请接口范型为 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetPRRecordsResponseDto>>({
        success: true,
        message: "获取记录成功",
        // GetPRRecordsResponseDto 反应的就是这个地方 data 的数据结构
        data: {
            records: pagedRecords,
            total: sortedForTimeline.length,
        },
    });
}

