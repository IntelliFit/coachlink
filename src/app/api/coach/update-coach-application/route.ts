import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    UpdateCoachApplicationDto,
    UpdateCoachApplicationResponseDto,
} from "./entity";
import { notifyPlatformOwners } from "@/lib/platformNotice";
import { applyCoachReviewSideEffects, isCoachReviewStatus } from "@/lib/coachApplicationReview";
import { isValidCoachContactPhone } from "@coachlink/core/src/coachPolicy";

const APPLICATION_STATUS_LABELS: Record<string, string> = {
    pending: "待审核",
    reviewing: "审核中",
    needs_info: "待补充材料",
    rejected: "已驳回",
};
import {
    sanitizeCoachTrack,
    sanitizeServiceModes,
    sanitizeTargetStudentLevels,
} from "@/lib/coachApplicationOptions";
import {
    deriveLegacyFieldsFromMaterials,
    normalizeCoachApplicationMaterials,
} from "@/lib/coachApplicationMaterials";

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id, user: session.user }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 通过 session 获取用户 ID
    const userId = authResult.userId;
    const body = await req.json() as UpdateCoachApplicationDto;

    // 首先获取申请记录以检查权限
    const { data: existingApplication, error: selectError } = await supabase
        .from("coach_applications")
        .select("*")
        .eq("id", body.id)
        .maybeSingle();

    if (selectError) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "查询教练申请失败: " + selectError.message,
            data: null,
        }, { status: 500 });
    }

    if (!existingApplication) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "未找到指定的教练申请",
            data: null,
        }, { status: 404 });
    }

    // 检查权限：
    // 1. 如果是普通用户，只能更新自己的申请，且不能更新状态和审核相关信息
    // 2. 如果是管理员，可以更新任何申请的所有字段
    const isAdmin = !!authResult.user?.is_admin;
    const isOwner = existingApplication.user_id === userId;

    if (!isAdmin && !isOwner) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "无权限更新该申请",
            data: null,
        }, { status: 403 });
    }

    const applicationMaterialsInput =
        body.applicationMaterials !== undefined
            ? body.applicationMaterials
            : (existingApplication as any).application_materials;
    const applicationMaterials = normalizeCoachApplicationMaterials(
        applicationMaterialsInput,
        {
            achievements: body.achievements ?? existingApplication.achievements,
            caseStudies: body.caseStudies ?? existingApplication.case_studies,
            credentials: (body.credentials ?? existingApplication.credentials) as any,
            socialLinks: (body.socialLinks ?? existingApplication.social_links) as any,
        },
    );
    const legacyFields = deriveLegacyFieldsFromMaterials(applicationMaterials, {
        achievements: body.achievements ?? existingApplication.achievements,
        caseStudies: body.caseStudies ?? existingApplication.case_studies,
        credentials: (body.credentials ?? existingApplication.credentials) as any,
        socialLinks: (body.socialLinks ?? existingApplication.social_links) as any,
    });

    // 构建更新对象
    const updateData: any = {};

    // 普通用户和管理员都能更新的字段
    if (body.name !== undefined) updateData.name = body.name;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.avatarUrl !== undefined) updateData.avatar_url = body.avatarUrl;
    if (body.specialties !== undefined) {
        updateData.specialties = body.specialties;
    }
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.yearsExperience !== undefined) {
        updateData.years_experience = body.yearsExperience;
    }
    if (body.achievements !== undefined) {
        updateData.achievements = legacyFields.achievements;
    }
    if (body.teachingPhilosophy !== undefined) {
        updateData.teaching_philosophy = body.teachingPhilosophy;
    }
    if (body.credentials !== undefined) {
        updateData.credentials = legacyFields.credentials;
    }
    if (body.caseStudies !== undefined) {
        updateData.case_studies = legacyFields.caseStudies;
    }
    if (body.applicationMaterials !== undefined) {
        updateData.application_materials = applicationMaterials;
        updateData.achievements = legacyFields.achievements;
        updateData.credentials = legacyFields.credentials;
        updateData.case_studies = legacyFields.caseStudies;
    }
    if (body.contactEmail !== undefined) {
        updateData.contact_email = body.contactEmail;
    }
    if (body.contactPhone !== undefined) {
        const submittedPhone = String(body.contactPhone ?? "").trim();
        if (submittedPhone && !isValidCoachContactPhone(submittedPhone)) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "请填写有效的手机号",
                data: null,
            }, { status: 400 });
        }
        // 手机号是审核联系方式：申请人重新提交时留空不覆盖已有号码，管理员可以清空
        if (submittedPhone || isAdmin) {
            updateData.contact_phone = submittedPhone || null;
        }
    }
    if (body.resumeUrl !== undefined) updateData.resume_url = body.resumeUrl;
    if (body.portfolioUrl !== undefined) {
        updateData.portfolio_url = body.portfolioUrl;
    }
    if (body.socialLinks !== undefined) {
        updateData.social_links = legacyFields.socialLinks;
    }
    if (body.coachTrack !== undefined) {
        updateData.coach_track = sanitizeCoachTrack(body.coachTrack);
    }
    if (body.serviceModes !== undefined) {
        updateData.service_modes = sanitizeServiceModes(body.serviceModes);
    }
    if (body.targetStudentLevels !== undefined) {
        updateData.target_student_levels = sanitizeTargetStudentLevels(
            body.targetStudentLevels,
        );
    }
    if (body.supportFocus !== undefined) {
        updateData.support_focus = body.supportFocus;
    }
    if (body.city !== undefined) {
        updateData.city = body.city;
    }
    if (body.county !== undefined) {
        updateData.county = body.county;
    }
    if (body.address !== undefined) {
        updateData.address = body.address;
    }
    if (body.latitude !== undefined) {
        updateData.latitude = body.latitude;
    }
    if (body.longitude !== undefined) {
        updateData.longitude = body.longitude;
    }
    if (body.province !== undefined) {
        updateData.province = body.province;
    }

    // 只有管理员才能更新的字段
    if (isAdmin) {
        if (body.status !== undefined) updateData.status = body.status;
        if (body.reviewNotes !== undefined) {
            updateData.review_notes = body.reviewNotes;
        }
        if (body.reviewedAt !== undefined) {
            updateData.reviewed_at = body.reviewedAt;
        }
        if (body.reviewedBy !== undefined) {
            updateData.reviewed_by = body.reviewedBy;
        }

        // 如果设置了审核状态且还没有设置审核人，则自动设置当前用户为审核人
        if (
            body.status !== undefined && !existingApplication.reviewed_by &&
            ["approved", "rejected", "needs_info"].includes(body.status)
        ) {
            updateData.reviewed_by = userId;
            updateData.reviewed_at = new Date().toISOString();
        }
    } else {
        updateData.status =
            existingApplication.status === "approved" ? "approved" : "pending";
    }

    // 更新申请记录
    const { data, error } = await supabase
        .from("coach_applications")
        .update(updateData)
        .eq("id", body.id)
        .select()
        .single();

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "更新教练申请失败: " + error.message,
            data: null,
        }, { status: 500 });
    }

    if (isAdmin) {
        // 根据选择的值进行后续处理：同步 coaches / users 并私信申请人
        if (body.status && isCoachReviewStatus(body.status)) {
            const result = await applyCoachReviewSideEffects({
                status: body.status,
                existingApplication,
                latestApplication: data,
                reviewNotes: body.reviewNotes,
            });
            if (!result.ok) {
                return NextResponse.json<ApiData<null>>({
                    success: false,
                    message: result.message,
                    data: null,
                }, { status: 500 });
            }
        }
    } else if (existingApplication.status !== "approved") {
        await serviceRoleSupabase
            .from("users")
            .update({ is_coach: false, coach_status: "pending" })
            .eq("id", existingApplication.user_id);

        // 已通过的教练改资料不打扰；待审/驳回/待补充的申请人重新提交才通知平台。
        await notifyPlatformOwners({
            kind: "coach_application_resubmitted",
            title: "教练申请已更新，待重新审核",
            fields: [
                ["申请人", data?.name || existingApplication.name],
                ["原状态", APPLICATION_STATUS_LABELS[existingApplication.status] || existingApplication.status],
            ],
            adminPath: "/admin/coach-applications",
        });
    }

    // 重要！必须声明接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<UpdateCoachApplicationResponseDto>>({
        success: true,
        message: "教练申请更新成功",
        // UpdateCoachApplicationResponseDto 反映的是这里的 data 数据结构
        data: {
            application: data,
        },
    });
}
