import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    ListStudentVideosDto,
    ListStudentVideosResponseDto,
    VideoItem,
} from "./entity";
import { ApiData } from "@/types/api";

function findMatchingActionExecution(actionExecutions: unknown, actionId: string) {
    if (!Array.isArray(actionExecutions)) return null;

    return actionExecutions.find((actionExecution: any) => (
        actionExecution?.id === actionId || actionExecution?.action_id === actionId
    )) ?? null;
}

function findMatchingSetExecution(sets: unknown, setNumber: number) {
    if (!Array.isArray(sets)) return null;

    return sets.find((setExecution: any, index: number) => (
        setExecution?.set_number === setNumber ||
        setExecution?.setNumber === setNumber ||
        index === Math.max(0, setNumber - 1)
    )) ?? null;
}

function pickSetValue(setExecution: any, ...keys: string[]) {
    for (const key of keys) {
        const value = setExecution?.[key];
        if (value !== undefined && value !== null && value !== "") {
            return value;
        }
    }
    return null;
}

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

    // -----------------------------
    // 1) execution_set_videos (计划执行中上传的组视频)
    // -----------------------------
    let execQueryBuilder = supabase
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
            plan_instance_executions!inner (student_id, action_executions, day_index)
        `,
            { count: "exact" },
        );

    // 核心修改：使用 .in 过滤多个学员
    execQueryBuilder = execQueryBuilder.in(
        "plan_instance_executions.student_id",
        targetStudentIds,
    );

    if (query) {
        execQueryBuilder = execQueryBuilder.ilike("exercise_name", `%${query}%`);
    }

    const offset = (page - 1) * pageSize;
    // NOTE: to support merging with training_videos, we fetch enough rows up to current page.
    execQueryBuilder = execQueryBuilder
        .order("created_at", { ascending: false })
        .range(0, offset + pageSize - 1);

    const { data: execVideos, error: execError, count: execCount } = await execQueryBuilder;

    if (execError) {
        console.error("查询执行视频失败:", execError);
        return NextResponse.json<ApiData<ListStudentVideosResponseDto>>({
            success: false,
            message: `查询视频失败: ${execError.message}`,
            data: null,
        }, { status: 500 });
    }

    // -----------------------------
    // 2) student_video_collections (视频集/视频管理：含描述、标签)
    // -----------------------------
    let vcQueryBuilder = supabase
        .from("student_video_collections")
        .select(
            `
            id,
            video_url,
            thumbnail_url,
            created_at,
            duration_seconds,
            user_id,
            title,
            description,
            tags,
            source,
            deleted_at
        `,
            { count: "exact" },
        )
        .in("user_id", targetStudentIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(0, offset + pageSize - 1);

    if (query) {
        const keyword = `%${query}%`;
        vcQueryBuilder = vcQueryBuilder.or(
            `description.ilike.${keyword},title.ilike.${keyword}`,
        );
    }

    const { data: collections, error: vcError, count: vcCount } = await vcQueryBuilder;

    if (vcError) {
        console.error("查询视频集失败:", vcError);
        return NextResponse.json<ApiData<ListStudentVideosResponseDto>>({
            success: false,
            message: `查询视频失败: ${vcError.message}`,
            data: null,
        }, { status: 500 });
    }

    // 获取所有涉及的学生ID，用于批量查询用户信息
    const studentIds = Array.from(
        new Set([
            ...(execVideos || [])
                .filter((v: any) => v.plan_instance_executions?.student_id)
                .map((v: any) => v.plan_instance_executions.student_id),
            ...(collections || []).map((v: any) => v.user_id),
        ]),
    );

    // 批量查询学生用户信息
    let studentProfiles: any[] = [];
    if (studentIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
            .from('user_profiles')
            .select('user_id, full_name, nickname, avatar_url')
            .in('user_id', studentIds);

        if (profileError) {
            console.error("查询用户档案失败:", profileError);
        } else {
            studentProfiles = profiles || [];
        }
    }

    // 创建学生ID到用户信息的映射
    const profileMap = new Map();
    studentProfiles.forEach(profile => {
        profileMap.set(profile.user_id, {
            id: profile.user_id,
            fullName: profile.full_name,
            nickname: profile.nickname,
            avatarUrl: profile.avatar_url,
        });
    });

    // 转换：execution_set_videos -> VideoItem
    const execItems: VideoItem[] = (execVideos || []).map((v: any) => {
        // 从执行记录的 action_executions 中补充动作名、计划/实际重量次数
        let actionName = v.exercise_name || "未命名动作";
        let weight: number | null = null;
        let reps: number | null = null;

        const actions = v.plan_instance_executions?.action_executions;
        const matchedAction = findMatchingActionExecution(actions, v.action_id);
        if (matchedAction) {
            actionName = matchedAction.action_name || matchedAction.name || actionName;

            const matchedSet = findMatchingSetExecution(matchedAction.sets, v.set_number || 1);
            if (matchedSet) {
                weight = pickSetValue(
                    matchedSet,
                    "actual_weight",
                    "actualWeight",
                    "completed_weight",
                    "planned_weight",
                    "plannedWeight",
                    "weight",
                );
                reps = pickSetValue(
                    matchedSet,
                    "actual_reps",
                    "actualReps",
                    "completed_reps",
                    "planned_reps",
                    "plannedReps",
                    "reps",
                );
            }
        }

        const studentId = v.plan_instance_executions?.student_id;
        const studentInfo = studentId ? profileMap.get(studentId) : undefined;

        return {
            id: v.id,
            videoUrl: v.video_url,
            thumbnailUrl: v.thumbnail_url,
            actionName,
            sourceType: "execution_set",
            setNumber: v.set_number || 1,
            weight,
            reps,
            isProgress: false, // v.is_progress_set || false, // 暂时默认为 false
            createdAt: v.created_at,
            duration: v.duration_seconds,
            dayIndex: v.plan_instance_executions?.day_index ?? null,
            studentInfo,
        };
    });

    // 转换：student_video_collections -> VideoItem（个人上传/视频集）
    const vcItems: VideoItem[] = (collections || []).map((v: any) => {
        const studentInfo = v.user_id ? profileMap.get(v.user_id) : undefined;
        const title = (v.title || "").trim();
        const desc = (v.description || "").trim();
        const actionName = title || desc || "个人上传视频";
        const tags = Array.isArray(v.tags) ? v.tags : [];
        return {
            id: `vc:${v.id}`,
            videoUrl: v.video_url,
            thumbnailUrl: v.thumbnail_url,
            actionName,
            description: desc || null,
            tags,
            sourceType: "video_collection",
            setNumber: 1,
            weight: null,
            reps: null,
            isProgress: v.source === "progress_set",
            createdAt: v.created_at,
            duration: v.duration_seconds,
            dayIndex: null,
            studentInfo,
        };
    });

    // 合并两类视频并分页
    // 合并：优先视频集（带描述/标签），再执行视频
    const mergedRaw = [...vcItems, ...execItems].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 去重：同一个 videoUrl 只保留一条（优先在 mergedRaw 前面的：视频集 > 执行视频）
    const byUrl = new Map<string, VideoItem>();
    for (const item of mergedRaw) {
        if (!item.videoUrl) continue;
        if (!byUrl.has(item.videoUrl)) byUrl.set(item.videoUrl, item);
    }
    const merged = Array.from(byUrl.values()).sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const videoItems = merged.slice(offset, offset + pageSize);

    const total = (execCount || 0) + (vcCount || 0);
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
