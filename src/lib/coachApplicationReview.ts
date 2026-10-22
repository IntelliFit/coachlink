import supabase, { serviceRoleSupabase } from "./supabaseClient";
import { sendSystemMessage } from "./chat";
import {
    buildCoachApprovedMessage,
    buildCoachNeedsInfoMessage,
    buildCoachRejectedMessage,
} from "./coachApplicationNotices";

/**
 * 管理员给出审核结论后的联动：同步 coaches / users，并私信申请人。
 * 后台审核接口和运营一次性脚本共用，保证两边行为一致。
 */

export type CoachReviewStatus = "approved" | "reviewing" | "needs_info" | "rejected";

const COACH_REVIEW_STATUSES: readonly string[] = ["approved", "reviewing", "needs_info", "rejected"];

export function isCoachReviewStatus(value: unknown): value is CoachReviewStatus {
    return typeof value === "string" && COACH_REVIEW_STATUSES.includes(value);
}

export type CoachReviewSideEffectResult =
    | { ok: true }
    | { ok: false; message: string };

type ApplicationRecord = Record<string, any>;

export function buildCoachProfileFromApplication(application: ApplicationRecord | null | undefined) {
    const profile: Record<string, any> = {};

    if (application?.teaching_philosophy !== undefined) {
        profile.teachingPhilosophy = application.teaching_philosophy;
    }
    if (application?.achievements !== undefined) {
        profile.achievements = application.achievements;
    }
    if (application?.case_studies !== undefined) {
        profile.caseStudies = application.case_studies;
    }
    if (application?.credentials !== undefined) {
        profile.credentials = application.credentials;
    }
    if (application?.contact_email !== undefined) {
        profile.contactEmail = application.contact_email;
    }
    if (application?.contact_phone !== undefined) {
        profile.contactPhone = application.contact_phone;
    }
    if (application?.social_links !== undefined) {
        profile.socialLinks = application.social_links;
    }
    if (application?.application_materials !== undefined) {
        profile.applicationMaterials = application.application_materials;
    }

    return profile;
}

export function buildCoachRecordFromApplication(
    latestApplication: ApplicationRecord,
    existingApplication: ApplicationRecord,
) {
    const coachProfile = buildCoachProfileFromApplication(latestApplication);
    return {
        user_id: existingApplication.user_id,
        name: latestApplication.name || existingApplication.name,
        title: latestApplication.title ?? null,
        avatar_url: latestApplication.avatar_url ?? null,
        specialties: latestApplication.specialties ?? null,
        bio: latestApplication.bio ?? null,
        years_experience: latestApplication.years_experience ?? null,
        achievements: latestApplication.achievements ?? null,
        coach_track: latestApplication.coach_track ?? "professional",
        service_modes: latestApplication.service_modes ?? [],
        target_student_levels: latestApplication.target_student_levels ?? [],
        support_focus: latestApplication.support_focus ?? null,
        profile: Object.keys(coachProfile).length ? coachProfile : null,
        province: latestApplication.province ?? null,
        city: latestApplication.city ?? null,
        county: latestApplication.county ?? null,
        address: latestApplication.address ?? null,
        latitude: latestApplication.latitude ?? null,
        longitude: latestApplication.longitude ?? null,
        status: "approved",
        updated_at: new Date().toISOString(),
    };
}

async function activateApprovedCoach(
    latestApplication: ApplicationRecord,
    existingApplication: ApplicationRecord,
    welcomeMessage: string,
): Promise<CoachReviewSideEffectResult> {
    const coachRecord = buildCoachRecordFromApplication(latestApplication, existingApplication);

    // 如果不存在教练账号则创建
    const { data: existCoach, error: existCoachError } = await supabase
        .from("coaches")
        .select("*")
        .eq("user_id", existingApplication.user_id)
        .maybeSingle();

    if (existCoachError) {
        return { ok: false, message: "查询教练失败: " + existCoachError.message };
    }

    if (!existCoach) {
        const { error: createCoachError } = await supabase
            .from("coaches")
            .insert({ ...coachRecord });
        if (createCoachError) {
            return { ok: false, message: "创建教练失败: " + createCoachError.message };
        }
    } else {
        const { error: updateCoachError } = await supabase
            .from("coaches")
            .update(coachRecord)
            .eq("id", existCoach.id);
        if (updateCoachError) {
            return { ok: false, message: "更新教练信息失败: " + updateCoachError.message };
        }
    }

    // 更新用户的 is_coach 标识，这样用户才能切换到教练端
    // 注意：coach_status 保持为 'approved'（数据库约束不允许 'coach'）
    // 前端通过 is_coach=true 来判断是否已完成教练身份认证
    const { error: updateProfileError } = await serviceRoleSupabase
        .from("users")
        .update({ is_coach: true, coach_status: "approved" })
        .eq("id", existingApplication.user_id);

    if (updateProfileError) {
        console.error("更新用户教练标识失败:", updateProfileError);
        // 不返回错误，因为教练记录已创建成功
    }

    await sendSystemMessage(existingApplication.user_id, {
        content: welcomeMessage,
    });
    return { ok: true };
}

export async function applyCoachReviewSideEffects(params: {
    status: CoachReviewStatus;
    existingApplication: ApplicationRecord;
    latestApplication?: ApplicationRecord | null;
    reviewNotes?: string | null;
    /** 测试账号清理等场景不需要通知申请人 */
    notifyApplicant?: boolean;
    /** 手册页上线前发出的通过私信不带手册链接 */
    includeHandbookLink?: boolean;
}): Promise<CoachReviewSideEffectResult> {
    const { status, existingApplication, reviewNotes } = params;
    const userId = existingApplication.user_id;
    const notify = params.notifyApplicant !== false;

    if (status === "approved") {
        return activateApprovedCoach(
            params.latestApplication || existingApplication,
            existingApplication,
            buildCoachApprovedMessage({ includeHandbook: params.includeHandbookLink }),
        );
    }

    if (status === "reviewing" || status === "needs_info") {
        await serviceRoleSupabase
            .from("users")
            .update({ is_coach: false, coach_status: "pending" })
            .eq("id", userId);
        // 待补充材料要告诉申请人缺什么、去哪补，否则申请会一直卡着
        if (status === "needs_info" && notify) {
            await sendSystemMessage(userId, { content: buildCoachNeedsInfoMessage(reviewNotes) });
        }
        return { ok: true };
    }

    await serviceRoleSupabase
        .from("users")
        .update({ is_coach: false, coach_status: "rejected" })
        .eq("id", userId);
    if (notify) {
        await sendSystemMessage(userId, { content: buildCoachRejectedMessage(reviewNotes) });
    }
    return { ok: true };
}
