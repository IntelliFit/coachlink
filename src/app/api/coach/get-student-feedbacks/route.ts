import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    GetStudentFeedbacksDto,
    GetStudentFeedbacksResponseDto,
    FeedbackItem,
} from "./entity";

/**
 * POST /api/coach/get-student-feedbacks
 *
 * 教练查看某个计划实例下学员的所有训练反馈
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const { instanceId, markRead } =
            (await req.json()) as GetStudentFeedbacksDto;

        if (!instanceId) {
            return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
                success: false,
                message: "缺少 instanceId",
                data: null,
            }, { status: 400 });
        }

        // 验证教练身份：通过 coaches 表查询 coach_id
        const { data: coachRow } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

        if (!coachRow) {
            return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
                success: false,
                message: "非教练身份",
                data: null,
            }, { status: 403 });
        }

        // 验证该计划实例属于此教练
        const { data: instance } = await supabase
            .from("coach_plan_instances")
            .select("id, coach_id")
            .eq("id", instanceId)
            .single();

        if (!instance || instance.coach_id !== coachRow.id) {
            return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
                success: false,
                message: "无权限查看此计划",
                data: null,
            }, { status: 403 });
        }

        // 查询反馈列表
        const { data: feedbacks, error: listErr } = await supabase
            .from("execution_feedbacks")
            .select("id, execution_id, day_index, content, difficulty_rating, coach_read_at, created_at")
            .eq("instance_id", instanceId)
            .order("created_at", { ascending: false })
            .limit(50);

        if (listErr) {
            console.error("[get-student-feedbacks] query failed:", listErr);
            return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
                success: false,
                message: "查询失败",
                data: null,
            }, { status: 500 });
        }

        const items: FeedbackItem[] = (feedbacks || []).map((f: any) => ({
            id: f.id,
            execution_id: f.execution_id,
            day_index: f.day_index,
            content: f.content,
            difficulty_rating: f.difficulty_rating,
            coach_read_at: f.coach_read_at,
            created_at: f.created_at,
        }));

        const unreadCount = items.filter((f) => !f.coach_read_at).length;

        // 可选：标记为已读
        if (markRead && unreadCount > 0) {
            const unreadIds = items
                .filter((f) => !f.coach_read_at)
                .map((f) => f.id);
            await supabase
                .from("execution_feedbacks")
                .update({ coach_read_at: new Date().toISOString() })
                .in("id", unreadIds);
        }

        return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
            success: true,
            message: "查询成功",
            data: {
                feedbacks: items,
                unread_count: unreadCount,
            },
        });
    } catch (error) {
        console.error("[get-student-feedbacks] error:", error);
        return NextResponse.json<ApiData<GetStudentFeedbacksResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}

