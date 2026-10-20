/**
 * Pure helpers for POST /api/coach/get-aggregated-info.
 * Kept free of Supabase/Redis so the merge rules and cache guards are unit-testable.
 */

export interface ReviewStats {
    reviewCount: number;
    averageRating: number;
}

/**
 * 用于将“教练申请表”的资料补全到 coaches.profile：
 * - 只在 coaches.profile 缺少该字段（undefined）时才补全
 * - 不覆盖教练已经填写/清空后的字段（哪怕是 null / [] / {}）
 */
export function mergeProfile(base: any, incoming: Record<string, any>) {
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

/** 合并教练申请中的字段，避免已审批教练丢失申请时填写的细节。没有申请时原样返回。 */
export function enrichCoachFromApplication<T extends Record<string, any>>(
    coach: T,
    application: Record<string, any> | null | undefined,
): T {
    if (!application) return coach;

    const profileFromApplication = {
        teachingPhilosophy: application.teaching_philosophy,
        achievements: application.achievements,
        caseStudies: application.case_studies,
        credentials: application.credentials,
        contactEmail: application.contact_email,
        contactPhone: application.contact_phone,
        socialLinks: application.social_links,
        applicationMaterials: application.application_materials,
        supportFocus: application.support_focus,
        coachTrack: application.coach_track,
        serviceModes: application.service_modes,
        targetStudentLevels: application.target_student_levels,
    };

    return {
        ...coach,
        name: coach.name || application.name,
        title: coach.title ?? application.title,
        avatar_url: coach.avatar_url ?? application.avatar_url,
        specialties: coach.specialties ?? application.specialties,
        bio: coach.bio ?? application.bio,
        coach_track: coach.coach_track ?? application.coach_track,
        service_modes: coach.service_modes?.length
            ? coach.service_modes
            : application.service_modes,
        target_student_levels: coach.target_student_levels?.length
            ? coach.target_student_levels
            : application.target_student_levels,
        support_focus: coach.support_focus ?? application.support_focus,
        years_experience: coach.years_experience ?? application.years_experience,
        achievements: coach.achievements ?? application.achievements,
        profile: mergeProfile(coach.profile, profileFromApplication),
    };
}

/** 评论数与平均分（保留一位小数）。 */
export function summarizeRatings(rows: Array<{ rating: number | null }> | null | undefined): ReviewStats {
    const reviewCount = rows?.length ?? 0;
    if (!rows || reviewCount === 0) return { reviewCount: 0, averageRating: 0 };
    const totalRating = rows.reduce((sum, review) => sum + (review.rating ?? 0), 0);
    return { reviewCount, averageRating: parseFloat((totalRating / reviewCount).toFixed(1)) };
}

/** Parses a cached ReviewStats JSON string; anything malformed counts as a cache miss. */
export function parseCachedReviewStats(raw: unknown): ReviewStats | null {
    if (typeof raw !== "string" || !raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (
            Number.isFinite(parsed?.reviewCount) &&
            Number.isFinite(parsed?.averageRating)
        ) {
            return { reviewCount: parsed.reviewCount, averageRating: parsed.averageRating };
        }
    } catch {
        // fall through to cache miss
    }
    return null;
}

/**
 * Resolves with the promise's value, or with `fallback` once `ms` elapses.
 * A rejection is passed through. Promise.race subscribes to `promise`, so a late
 * rejection after the timeout is still handled and never becomes unhandled.
 */
export function settleWithin<T, F>(promise: Promise<T>, ms: number, fallback: F): Promise<T | F> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<F>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
