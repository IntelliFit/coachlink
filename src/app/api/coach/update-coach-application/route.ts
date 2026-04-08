import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type {
    UpdateCoachApplicationDto,
    UpdateCoachApplicationResponseDto,
} from "./entity";
import { sendSystemMessage } from "@/lib/chat";
import {
    sanitizeCoachTrack,
    sanitizeServiceModes,
    sanitizeTargetStudentLevels,
} from "@/lib/coachApplicationOptions";

function buildCoachProfileFromApplication(application: any) {
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

    return profile;
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 通过 session 获取用户 ID
    const userId = session.user.id;
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
    const isAdmin = session.user.is_admin;
    const isOwner = existingApplication.user_id === userId;

    if (!isAdmin && !isOwner) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "无权限更新该申请",
            data: null,
        }, { status: 403 });
    }

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
        updateData.achievements = body.achievements;
    }
    if (body.teachingPhilosophy !== undefined) {
        updateData.teaching_philosophy = body.teachingPhilosophy;
    }
    if (body.credentials !== undefined) {
        updateData.credentials = body.credentials;
    }
    if (body.caseStudies !== undefined) {
        updateData.case_studies = body.caseStudies;
    }
    if (body.contactEmail !== undefined) {
        updateData.contact_email = body.contactEmail;
    }
    if (body.contactPhone !== undefined) {
        updateData.contact_phone = body.contactPhone;
    }
    if (body.resumeUrl !== undefined) updateData.resume_url = body.resumeUrl;
    if (body.portfolioUrl !== undefined) {
        updateData.portfolio_url = body.portfolioUrl;
    }
    if (body.socialLinks !== undefined) {
        updateData.social_links = body.socialLinks;
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
        // 根据选择的值进行后续处理
        if (body.status === "approved") {
            const latestApplication = data || existingApplication;
            const coachProfile = buildCoachProfileFromApplication(latestApplication);
            const coachUpsertData = {
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
                target_student_levels:
                    latestApplication.target_student_levels ?? [],
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

            // 如果不存在教练账号则创建
            const { data: existCoach, error: existCoachError } = await supabase
                .from("coaches")
                .select("*")
                .eq("user_id", existingApplication.user_id)
                .maybeSingle();

            if (existCoachError) {
                return NextResponse.json<ApiData<null>>({
                    success: false,
                    message: "查询教练失败: " + existCoachError.message,
                    data: null,
                }, { status: 500 });
            }

            if (!existCoach) {
                const { error: createCoachError } = await supabase
                    .from("coaches")
                    .insert({
                        ...coachUpsertData,
                    });

                if (createCoachError) {
                    return NextResponse.json<ApiData<null>>({
                        success: false,
                        message: "创建教练失败: " + createCoachError.message,
                        data: null,
                    }, { status: 500 });
                }
            } else {
                const { error: updateCoachError } = await supabase
                    .from("coaches")
                    .update(coachUpsertData)
                    .eq("id", existCoach.id);

                if (updateCoachError) {
                    return NextResponse.json<ApiData<null>>({
                        success: false,
                        message: "更新教练信息失败: " + updateCoachError.message,
                        data: null,
                    }, { status: 500 });
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
                content:
                    "您提交的教练申请已经通过🎉，恭喜您成为了一名教链平台的教练。在正式开始您的招生生意前，您需要先完成 [订阅设置](/dashboard/pricing) 和 [学员问卷](/dashboard/questionnaire) 这两部分的编辑，这样，才能最大限度利用教链平台提供的功能为您服务。",
            });
        } else if (body.status === "reviewing" || body.status === "needs_info") {
            await serviceRoleSupabase
                .from("users")
                .update({ is_coach: false, coach_status: "pending" })
                .eq("id", existingApplication.user_id);
        } else if (body.status === "rejected") {
            await serviceRoleSupabase
                .from("users")
                .update({ is_coach: false, coach_status: "rejected" })
                .eq("id", existingApplication.user_id);
            await sendSystemMessage(existingApplication.user_id, {
                content: `您提交的教练申请未通过，原因： ${
                    body.reviewNotes || "无"
                }。\n您可以在 [申请成为教练](/coach/application) 查看原因并加以修改。`,
            });
        }
    } else if (existingApplication.status !== "approved") {
        await serviceRoleSupabase
            .from("users")
            .update({ is_coach: false, coach_status: "pending" })
            .eq("id", existingApplication.user_id);
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
