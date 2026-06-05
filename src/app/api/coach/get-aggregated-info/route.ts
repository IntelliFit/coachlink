import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetAggregatedInfoDto,
    GetAggregatedInfoResponseDto,
} from "./entity";
import redis from "@/lib/redisClient";
import { filterPublicCoachApplicationMaterials } from "@/lib/coachApplicationMaterials";

function stripSensitiveCoachFieldsForPublicView(coach: any) {
    if (!coach) return coach;
    const next = { ...(coach || {}) };

    // 支付相关敏感字段（兼容旧字段与新字段）
    next.payment_qr_code = undefined;
    next.payment_qr_codes = undefined;
    next.allow_personal_qrcode = undefined;
    next.payment_mode = undefined;

    // 邀请码相关（避免公开扩散）
    next.invitation_code = undefined;
    next.invitation_mode = undefined;

    // profile 中的联系方式/社交链接等敏感信息
    if (next.profile && typeof next.profile === "object") {
        const p = { ...next.profile };
        delete (p as any).contactEmail;
        delete (p as any).contactPhone;
        delete (p as any).socialLinks;
        if ((p as any).applicationMaterials) {
            (p as any).applicationMaterials = filterPublicCoachApplicationMaterials(
                (p as any).applicationMaterials,
            );
        }
        next.profile = p;
    }

    return next;
}

function filterCoachMaterialsForViewer(coach: any, canViewPrivate: boolean) {
    if (!coach?.profile || typeof coach.profile !== "object" || canViewPrivate) {
        return coach;
    }

    return {
        ...coach,
        profile: {
            ...coach.profile,
            applicationMaterials: filterPublicCoachApplicationMaterials(
                coach.profile.applicationMaterials,
            ),
        },
    };
}

/**
 * 用于将“教练申请表”的资料补全到 coaches.profile：
 * - 只在 coaches.profile 缺少该字段（undefined）时才补全
 * - 不覆盖教练已经填写/清空后的字段（哪怕是 null / [] / {}）
 */
function mergeProfile(base: any, incoming: Record<string, any>) {
    if (!incoming) return base || null;
    const merged = { ...(base || {}) };
    Object.entries(incoming || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (merged[key] === undefined) {
            merged[key] = value;
        }
    });
    return merged;
}

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
    const uniqueTags = Array.from(new Set(allTags));

    return uniqueTags;
}

async function getContentCount(coachId: string) {
    const { count, error } = await supabase
        .from("coach_contents")
        .select("*", { count: "exact", head: true })
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
        .select("*", { count: "exact", head: true })
        .eq("coach_id", coachId)
        .eq("status", "active");

    if (error) {
        console.error(error);
        return 0;
    }

    return count || 0;
}

async function getReviewCount(coachId: string) {
    const cacheKey = `coach:reviews:${coachId}`;

    // 尝试从缓存中获取数据
    try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData as string);
        }
    } catch (err) {
        console.error("Redis get error:", err);
    }

    // 获取评论数量和平均评分
    const { data: reviewsData, error: reviewsError } = await supabase
        .from("student_comments")
        .select("rating")
        .eq("coach_id", coachId);

    let reviewCount = 0;
    let averageRating = 0;

    if (!reviewsError && reviewsData) {
        reviewCount = reviewsData.length;
        if (reviewCount > 0) {
            const totalRating = reviewsData.reduce(
                (sum, review) => sum + review.rating,
                0,
            );
            averageRating = parseFloat((totalRating / reviewCount).toFixed(1));
        }
    }

    // 将结果存入缓存，设置5分钟过期时间
    const result = { reviewCount, averageRating };
    try {
        await redis.setEx(cacheKey, 300, JSON.stringify(result));
    } catch (err) {
        console.error("Redis set error:", err);
    }

    return result;
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const isAuthenticated = Boolean(session?.user?.id);

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

    // 获取教练基本信息
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

    // 合并教练申请中的字段，避免已审批教练丢失申请时填写的细节
    let enrichedCoach = coach;
    try {
        const { data: latestApplication } = await supabase
            .from("coach_applications")
            .select("*")
            .eq("user_id", coach.user_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestApplication) {
            const profileFromApplication = {
                teachingPhilosophy: latestApplication.teaching_philosophy,
                achievements: latestApplication.achievements,
                caseStudies: latestApplication.case_studies,
                credentials: latestApplication.credentials,
                contactEmail: latestApplication.contact_email,
                contactPhone: latestApplication.contact_phone,
                socialLinks: latestApplication.social_links,
                applicationMaterials: (latestApplication as any).application_materials,
                supportFocus: latestApplication.support_focus,
                coachTrack: latestApplication.coach_track,
                serviceModes: latestApplication.service_modes,
                targetStudentLevels: latestApplication.target_student_levels,
            };

            enrichedCoach = {
                ...coach,
                name: coach.name || latestApplication.name,
                title: coach.title ?? latestApplication.title,
                avatar_url: coach.avatar_url ?? latestApplication.avatar_url,
                specialties: coach.specialties ?? latestApplication.specialties,
                bio: coach.bio ?? latestApplication.bio,
                coach_track: coach.coach_track ?? latestApplication.coach_track,
                service_modes: coach.service_modes?.length
                    ? coach.service_modes
                    : latestApplication.service_modes,
                target_student_levels: coach.target_student_levels?.length
                    ? coach.target_student_levels
                    : latestApplication.target_student_levels,
                support_focus: coach.support_focus ?? latestApplication.support_focus,
                years_experience: coach.years_experience ??
                    latestApplication.years_experience,
                achievements: coach.achievements ??
                    latestApplication.achievements,
                profile: mergeProfile(coach.profile, profileFromApplication),
            };
        }
    } catch (err) {
        console.error("合并教练申请信息失败:", err);
    }

    // 如果教练头像仍为空，尝试从 user_profiles 获取（与导航栏头像保持一致）
    if (!enrichedCoach.avatar_url && coach.user_id) {
        try {
            const { data: userProfile } = await supabase
                .from("user_profiles")
                .select("avatar_url")
                .eq("user_id", coach.user_id)
                .maybeSingle();

            if (userProfile?.avatar_url) {
                enrichedCoach = {
                    ...enrichedCoach,
                    avatar_url: userProfile.avatar_url,
                };
            }
        } catch (err) {
            console.error("获取用户头像失败:", err);
        }
    }

    const [
        studentCount,
        contentCount,
        templateSpecialties,
        { reviewCount, averageRating },
    ] = await Promise.all([
        getStudentCount(enrichedCoach.id),
        getContentCount(enrichedCoach.id),
        enrichedCoach.user_id
            ? getUniqueTags(enrichedCoach.user_id)
            : Promise.resolve([]),
        getReviewCount(enrichedCoach.id),
    ]);

    const specialties = Array.from(
        new Set([
            ...(enrichedCoach.specialties || []),
            ...(templateSpecialties || []),
        ]),
    );
    const canViewPrivateMaterials = Boolean(
        session?.user?.is_admin || session?.user?.id === enrichedCoach.user_id,
    );
    const visibleCoach = isAuthenticated
        ? filterCoachMaterialsForViewer(enrichedCoach, canViewPrivateMaterials)
        : stripSensitiveCoachFieldsForPublicView(enrichedCoach);

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
