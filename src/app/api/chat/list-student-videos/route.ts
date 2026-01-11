import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type {
    ListStudentVideosDto,
    ListStudentVideosResponseDto,
    VideoItem,
} from "./entity";
import { ApiData } from "@/types/api";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<ListStudentVideosResponseDto>>({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const {
        studentId,
        query,
        onlyProgress = false,
        page = 1,
        pageSize = 20,
    } = await req.json() as ListStudentVideosDto;

    const userId = session.user.id;

    let targetStudentIds: string[] = [];
    if (studentId) {
        // 场景 A: 指定了学员 ID
        if (userId !== studentId) {
            // 检查是否是该学员的教练
            const { data: coach } = await supabase.from('coaches').select('id').eq('user_id', userId).single();
            if (!coach) return NextResponse.json({ success: false, message: "无权访问" }, { status: 403 });

            const { data: sub } = await supabase
                .from("coach_subscriptions")
                .select("id")
                .eq("coach_id", coach.id)
                .eq("student_id", studentId)
                .eq("status", "active")
                .maybeSingle();

            if (!sub) return NextResponse.json({ success: false, message: "无权限查看该学员视频" }, { status: 403 });
        }
        targetStudentIds = [studentId];
    } else {
        // 场景 B: 未指定学员 ID，尝试作为教练获取所有学员
        const { data: coach } = await supabase.from('coaches').select('id').eq('user_id', userId).single();

        if (!coach) {
            // 如果不是教练，又没传 studentId，默认看自己的
            targetStudentIds = [userId];
        } else {
            // 获取该教练下所有活跃学员的 ID
            const { data: subs } = await supabase
                .from("coach_subscriptions")
                .select("student_id")
                .eq("coach_id", coach.id)
                .eq("status", "active");

            if (!subs || subs.length === 0) {
                // 如果该教练没有学员，直接返回空列表
                return NextResponse.json({ success: true, message: "暂无学员数据", data: { videos: [], hasMore: false, total: 0 } });
            }
            targetStudentIds = subs.map(s => s.student_id);
        }
    }

    let queryBuilder = supabase
        .from("execution_set_videos")
        .select(
            `
                id,
                action_id,
                video_url,
                thumbnail_url,
                exercise_name,
                set_number,
                duration_seconds,
                created_at,
                plan_instance_executions!inner(student_id, action_executions, day_index)
            `,
            { count: "exact" },
        );

    // 核心修改：使用 .in 过滤多个学员
    queryBuilder = queryBuilder.in(
        "plan_instance_executions.student_id",
        targetStudentIds,
    );

    if (query) {
        queryBuilder = queryBuilder.ilike("exercise_name", `%${query}%`);
    }

    const offset = (page - 1) * pageSize;
    queryBuilder = queryBuilder
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

    const { data: videos, error, count } = await queryBuilder;

    if (error) {
        console.error("查询视频失败:", error);
        return NextResponse.json<ApiData<ListStudentVideosResponseDto>>({
            success: false,
            message: `查询视频失败: ${error.message}`,
            data: null,
        }, { status: 500 });
    }

    // 转换为返回格式
    const videoItems: VideoItem[] = (videos || []).map((v: any) => {
        // 从执行记录的 action_executions 中补充动作名、计划/实际重量次数
        let actionName = v.exercise_name || "未命名动作";
        let weight: number | null | undefined = undefined;
        let reps: number | null | undefined = undefined;

        const actions = v.plan_instance_executions?.action_executions;
        if (Array.isArray(actions)) {
            const matchedAction = actions.find((a: any) => a.action_id === v.action_id);
            if (matchedAction) {
                actionName = matchedAction.action_name || actionName;
                const sets = matchedAction.sets;
                if (Array.isArray(sets) && v.set_number) {
                    const setIdx = Math.max(0, (v.set_number as number) - 1);
                    const matchedSet = sets[setIdx];
                    if (matchedSet) {
                        weight = matchedSet.actual_weight ?? matchedSet.planned_weight ?? weight;
                        reps = matchedSet.actual_reps ?? matchedSet.planned_reps ?? reps;
                    }
                }
            }
        }

        return {
            id: v.id,
            videoUrl: v.video_url,
            thumbnailUrl: v.thumbnail_url,
            actionName,
            setNumber: v.set_number || 1,
            weight,
            reps,
            isProgress: false, // v.is_progress_set || false, // 暂时默认为 false
            createdAt: v.created_at,
            duration: v.duration_seconds,
            dayIndex: v.plan_instance_executions?.day_index ?? null,
        };
    });

    const total = count || 0;
    const hasMore = offset + videoItems.length < total;

    return NextResponse.json<ApiData<ListStudentVideosResponseDto>>({
        success: true,
        message: "加载视频成功",
        data: {
            videos: videoItems,
            hasMore,
            total,
        },
    });
}
