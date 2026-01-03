import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Database } from "@/types/database.types";
import type { UpdateCoachProfileDto, UpdateCoachProfileResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

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

    try {
        const body = await request.json() as UpdateCoachProfileDto;
        const { id, name, title, avatarUrl, specialties, yearsExperience, bio, profile } = body;

        // 检查教练是否存在且属于当前用户
        const { data: coach, error: coachError } = await supabase
            .from('coaches')
            .select('id, user_id, profile')
            .eq('id', id)
            .single();

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

        const { data, error } = await supabase
            .from('coaches')
            .update(updateData)
            .eq('id', id)
            .select()
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

        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({ 
            success: true, 
            message: "教练信息更新成功",
            data: data as any
        });
    
    } catch (error: any) {
        console.error('更新教练信息异常:', error);
        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({ 
            success: false, 
            message: error.message,
            data: null
        }, { status: 500 });
    }
}