import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetAggregatedInfoDto,
    GetAggregatedInfoResponseDto,
} from "./entity";
import redis from "@/lib/redisClient";
import { COACH_PROFILE_VIEW, coachViewForViewer } from "@/lib/coachPublicView";
import { getCoachViewer } from "@/lib/coachViewer";
import {
    enrichCoachFromApplication,
    parseCachedReviewStats,
    settleWithin,
    summarizeRatings,
    type ReviewStats,
} from "@/lib/coachAggregatedInfo";

const REVIEW_CACHE_TTL_SECONDS = 300;
/**
 * 评论统计缓存只是锦上添花：Redis 不可达时（本地开发解析不到 `redis` 主机名、
 * 连接超时 10s）不能拖住整个接口，超过这个预算就直接查库。
 */
const REVIEW_CACHE_READ_BUDGET_MS = 200;

async function getUniqueTags(userId: string) {
    const { data, error } = await supabase
        .from("coach_plan_templates")
        .select("tags")
        .eq("coach_id", userId);

    if (error) {
        return [];
    }

    // 提取并去重所有标签
    const allTags = data.flatMap((template) => template.tags || []);
    return Array.from(new Set(allTags));
}

async function getContentCount(coachId: string) {
    const { count, error } = await supabase
        .from("coach_contents")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coachId);

    if (error) {
        console.error(error);
        return 0;
    }

    return count || 0;
}

async function getStudentCount(coachId: string) {
    const { count, error } = await supabase
        .from("coach_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coachId)
        .eq("status", "active");

    if (error) {
        console.error(error);
        return 0;
    }

    return count || 0;
}

async function readCachedReviewStats(cacheKey: string): Promise<ReviewStats | null> {
    try {
        const cached = await settleWithin(redis.get(cacheKey), REVIEW_CACHE_READ_BUDGET_MS, null);
        return parseCachedReviewStats(cached);
    } catch (err) {
        console.error("Redis get error:", err);
        return null;
    }
}

async function getReviewStats(coachId: string): Promise<ReviewStats> {
    const cacheKey = `coach:reviews:${coachId}`;
    const cached = await readCachedReviewStats(cacheKey);
    if (cached) return cached;

    const { data: reviewsData, error: reviewsError } = await supabase
        .from("student_comments")
        .select("rating")
        .eq("coach_id", coachId);

    if (reviewsError) {
        console.error("获取教练评论失败:", reviewsError);
    }
    const result = summarizeRatings(reviewsError ? null : reviewsData);

    // 写缓存不阻塞响应，设置5分钟过期时间
    redis.setEx(cacheKey, REVIEW_CACHE_TTL_SECONDS, JSON.stringify(result))
        .catch((err) => console.error("Redis set error:", err));

    return result;
}

async function getLatestApplication(userId: string) {
    const { data, error } = await supabase
        .from("coach_applications")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("合并教练申请信息失败:", error);
        return null;
    }
    return data;
}

async function getProfileAvatar(userId: string) {
    const { data, error } = await supabase
        .from("user_profiles")
        .select("avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error("获取用户头像失败:", error);
        return null;
    }
    return data?.avatar_url ?? null;
}

export async function POST(req: Request) {
    const {
        coachId,
    } = await req.json() as GetAggregatedInfoDto;

    if (!coachId) {
        return NextResponse.json<ApiData<GetAggregatedInfoResponseDto>>({
            success: false,
            message: "缺少 coachId",
            data: null,
        }, { status: 400 });
    }

    // 第一阶段：只依赖 coachId 的查询全部并行发出
    const viewerPromise = getCoachViewer(req);
    const statsPromise = Promise.all([
        getStudentCount(coachId),
        getContentCount(coachId),
        getReviewStats(coachId),
    ]);
    // 教练不存在时会提前返回而不再 await；先挂一个处理器，避免这里的失败变成 unhandled rejection。
    statsPromise.catch(() => undefined);

    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("*")
        .eq("id", coachId)
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<GetAggregatedInfoResponseDto>>({
            success: false,
            message: "教练信息不存在",
            data: null,
        });
    }

    // 第二阶段：依赖 coach.user_id 的查询并行发出。
    // 头像兜底（user_profiles，与导航栏头像保持一致）在教练头像为空时预取，合并申请后仍为空才使用。
    const userId = coach.user_id;
    const [latestApplication, profileAvatar, templateSpecialties] = await Promise.all([
        userId ? getLatestApplication(userId) : Promise.resolve(null),
        userId && !coach.avatar_url ? getProfileAvatar(userId) : Promise.resolve(null),
        userId ? getUniqueTags(userId) : Promise.resolve([]),
    ]);

    const merged = enrichCoachFromApplication(coach, latestApplication);
    const enrichedCoach = !merged.avatar_url && profileAvatar
        ? { ...merged, avatar_url: profileAvatar }
        : merged;

    const [
        viewer,
        [studentCount, contentCount, { reviewCount, averageRating }],
    ] = await Promise.all([viewerPromise, statsPromise]);

    const specialties = Array.from(
        new Set([
            ...(enrichedCoach.specialties || []),
            ...(templateSpecialties || []),
        ]),
    );
    const visibleCoach = coachViewForViewer(viewer, enrichedCoach, COACH_PROFILE_VIEW);

    return NextResponse.json<ApiData<GetAggregatedInfoResponseDto>>({
        success: true,
        message: "获取成功",
        data: {
            coach: visibleCoach,
            contentCount,
            studentCount,
            reviewCount,
            averageRating,
            specialties,
        },
    });
}
