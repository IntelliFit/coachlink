import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type {
    ListStudentVideosDto,
    ListStudentVideosResponseDto,
    VideoItem,
} from "./entity";

/**
 * POST /api/chat/list-student-videos
 *
 * 获取学员的训练执行视频列表，用于聊天中引用
 * 教练可以查看其学员的视频，学员可以查看自己的视频
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ListStudentVideosResponseDto>({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const {
        studentId,
        query,
        onlyProgress = false,
        page = 1,
        pageSize = 20,
    } = await req.json() as ListStudentVideosDto;

    if (!studentId) {
        return NextResponse.json<ListStudentVideosResponseDto>({
            success: false,
            message: "缺少学员ID",
            data: null,
        }, { status: 400 });
    }

    // 权限验证：当前用户必须是学员本人或学员的教练
    if (currentUserId !== studentId) {
        // 检查是否是该学员的教练
        const { data: subscription, error: subError } = await supabase
            .from("coach_subscriptions")
            .select("id")
            .eq("coach_id", currentUserId)
            .eq("student_id", studentId)
            .eq("status", "active")
            .maybeSingle();

        if (subError || !subscription) {
            return NextResponse.json<ListStudentVideosResponseDto>({
                success: false,
                message: "无权限查看该学员视频",
                data: null,
            }, { status: 403 });
        }
    }

    try {
        // 构建查询 (使用 as any 避免 TypeScript 类型推导过深)
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
            ) as any;

        // 通过关联表过滤学员
        queryBuilder = queryBuilder.eq(
            "plan_instance_executions.student_id",
            studentId,
        );

        // 搜索过滤
        if (query) {
            queryBuilder = queryBuilder.ilike("exercise_name", `%${query}%`);
        }

        // 只看进步视频
        // 只看进步视频 (暂时禁用，因为 execution_set_videos 表中没有 is_progress_set 字段)
        // if (onlyProgress) {
        //     queryBuilder = queryBuilder.eq("is_progress_set", true);
        // }

        // 分页和排序
        const offset = (page - 1) * pageSize;
        queryBuilder = queryBuilder
            .order("created_at", { ascending: false })
            .range(offset, offset + pageSize - 1);

        const { data: videos, error, count } = await queryBuilder;

        if (error) {
            console.error("查询视频失败:", error);
            return NextResponse.json<ListStudentVideosResponseDto>({
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

        return NextResponse.json<ListStudentVideosResponseDto>({
            success: true,
            data: {
                videos: videoItems,
                hasMore,
                total,
            },
        });
    } catch (error) {
        console.error("获取学员视频失败:", error);
        return NextResponse.json<ListStudentVideosResponseDto>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
