import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Database } from "@/types/database.types";
import type { UpdateCoachProfileDto, UpdateCoachProfileResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { headers } from "next/headers";
import {
    upsertCoachPosterQueued,
    tryAcquireCoachPosterJob,
    generateInvitationPosterInBackground,
    INVITATION_POSTER_TYPE,
} from "@/lib/coachPoster";

async function getRequestOrigin(): Promise<string> {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "http";
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) return `${proto}://${host}`;
    return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

function mergeProfile(base: any, incoming?: UpdateCoachProfileDto["profile"]) {
    if (!incoming) {
        return base || null;
    }

    const merged = { ...(base || {}) };
    Object.entries(incoming).forEach(([key, value]) => {
        if (value !== undefined) {
            merged[key] = value;
        }
    });

    return merged;
}

export async function POST(request: Request) {

    const session = await getServerSession();

    if (!session?.user?.id) {
        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({
            success: false,
            message: "用户未登录",
            data: null
        }, { status: 401 });
    }
    const body = await request.json() as UpdateCoachProfileDto;

    const {
        id,
        userId,
        name,
        title,
        avatarUrl,
        specialties,
        yearsExperience,
        bio,
        profile,
        invitationCode,
        invitationMode,
        province,
        city,
        county,
        address,
        latitude,
        longitude
    } = body;

    let queryBuilter = supabase
        .from('coaches')
        .select('*');

    if (id) {
        queryBuilter = queryBuilter.eq('id', id);
    } else if (userId) {
        queryBuilter = queryBuilter.eq('user_id', userId);
    } else {
        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({
            success: false,
            message: "请提供教练ID或用户ID",
            data: null
        }, { status: 400 });
    }

    // 检查教练是否存在且属于当前用户
    const { data: coach, error: coachError } = await queryBuilter.single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({
            success: false,
            message: "教练不存在",
            data: null
        }, { status: 404 });
    }

    // 验证权限 - 只有教练本人才能更新自己的信息
    if (coach.user_id !== session.user.id) {
        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({
            success: false,
            message: "无权限访问",
            data: null
        }, { status: 403 });
    }

    if (invitationCode) {
        // 1. 如果原始教练数据中已经有码了，根据你之前的逻辑是不允许修改的
        if (coach.invitation_code && coach.invitation_code !== invitationCode) {
            return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({
                success: false,
                message: "邀请码设置后无法更改",
                data: null
            }, { status: 400 });
        }

        // 2. 检查数据库中是否存在其他教练使用了这个码
        const { data: existingCodeCoach, error: checkError } = await supabase
            .from('coaches')
            .select('id')
            .eq('invitation_code', invitationCode)
            .neq('id', coach.id)
            .maybeSingle();

        if (checkError) {
            return NextResponse.json({ success: false, message: "校验邀请码失败" }, { status: 500 });
        }

        if (existingCodeCoach) {
            return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({
                success: false,
                message: "该邀请码已被占用，请尝试其他号码",
                data: null
            }, { status: 200 });
        }
    }

    // 更新教练信息（以申请页字段为准）
    const mergedProfile = mergeProfile(coach.profile, profile);
    const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (title !== undefined) updateData.title = title;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
    if (specialties !== undefined) updateData.specialties = specialties;
    if (yearsExperience !== undefined) updateData.years_experience = yearsExperience;
    if (bio !== undefined) updateData.bio = bio || null;
    if (profile !== undefined) updateData.profile = mergedProfile;
    if (invitationCode !== undefined) updateData.invitation_code = invitationCode;
    if (invitationMode !== undefined) updateData.invitation_mode = invitationMode;
    if (province !== undefined) updateData.province = province;
    if (city !== undefined) updateData.city = city;
    if (county !== undefined) updateData.county = county;
    if (address !== undefined) updateData.address = address;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;

    let updateBuilder = supabase
        .from('coaches')
        .update(updateData);

    if (id) {
        updateBuilder = updateBuilder.eq('id', id);
    } else if (userId) {
        updateBuilder = updateBuilder.eq('user_id', userId);
    }

    const { data, error } = await updateBuilder
        .select('*')
        .single();

    if (error) {
        console.error('更新教练信息失败:', error);
        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({
            success: false,
            message: error.message,
            data: null
        }, { status: 500 });
    }

    // 同步用户头像/昵称到 user_profiles（保持教练端与学员端一致）
    const syncProfile: Record<string, any> = {};
    if (avatarUrl !== undefined) syncProfile.avatar_url = avatarUrl || null;
    if (name !== undefined) syncProfile.nickname = name;
    if (Object.keys(syncProfile).length > 0) {
        const { error: userProfileError } = await supabase
            .from('user_profiles')
            .update({ ...syncProfile, updated_at: new Date().toISOString() })
            .eq('user_id', session.user.id);
        if (userProfileError) {
            console.error('同步用户档案头像/昵称失败:', userProfileError);
        }
    }

    // 触发“邀请高清海报”后台生成（不阻塞主更新流程）
    try {
        await upsertCoachPosterQueued({
            coachId: data.id,
            posterType: INVITATION_POSTER_TYPE,
            requestedBy: session.user.id,
        });
        const acquired = await tryAcquireCoachPosterJob({
            coachId: data.id,
            posterType: INVITATION_POSTER_TYPE,
            requestedBy: session.user.id,
        });
        if (acquired) {
            const h = await headers();
            const cookieHeader = h.get("cookie") || undefined;
            generateInvitationPosterInBackground({
                coachId: data.id,
                requestedBy: session.user.id,
                origin: await getRequestOrigin(),
                cookieHeader,
            });
        }
    } catch (e) {
        console.error("[update-coach-profile] enqueue poster generation failed:", e);
    }

    return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({
        success: true,
        message: "教练信息更新成功",
        data: data
    });
}