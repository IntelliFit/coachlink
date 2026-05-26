import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: Request) {
    const authResult = await getAuthUser(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    const userId = authResult.userId;

    // 获取请求数据
    const body = await request.json();

    // Only update fields explicitly sent by the client. This keeps single-field
    // profile edits from accidentally clearing unrelated registration answers.
    const profileData: Record<string, any> = {
        updated_at: new Date().toISOString(),
    };

    const assignIfProvided = (key: string, value: any) => {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            profileData[key] = value;
        }
    };

    assignIfProvided("full_name", body.full_name);
    assignIfProvided("nickname", body.nickname);
    assignIfProvided("phone", body.phone);
    assignIfProvided("avatar_url", body.avatar_url);
    assignIfProvided("address", body.address);
    assignIfProvided("gender", body.gender);
    assignIfProvided("birth_date", body.birth_date);
    assignIfProvided("height", body.height != null ? Number(body.height) : null);
    assignIfProvided("weight", body.weight != null ? Number(body.weight) : null);
    assignIfProvided("fitness_goal", body.fitness_goal);
    assignIfProvided("fitness_level", body.fitness_level);
    assignIfProvided("bio", body.bio);

    // 添加新字段（仅当提供时才更新）
    if (body.age !== undefined) {
        profileData.age = body.age;
    }
    if (body.lifestyle !== undefined) {
        profileData.lifestyle = body.lifestyle;
    }
    if (body.sport_cards !== undefined) {
        profileData.sport_cards = body.sport_cards;
    }
    if (body.onboarding_completed !== undefined) {
        profileData.onboarding_completed = body.onboarding_completed;
    }

    // 检查用户档案是否已存在
    const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    let result;
    if (existingProfile) {
        // 更新现有档案
        const { data, error: updateError } = await supabase
            .from("user_profiles")
            .update(profileData)
            .eq("user_id", userId)
            .select("*")
            .single();

        if (updateError) {
            return NextResponse.json({
                success: false,
                message: updateError.message,
            });
        }

        result = data;
    } else {
        // 创建新档案
        const { data, error: insertError } = await supabase
            .from("user_profiles")
            .insert({
                ...profileData,
                user_id: userId,
                created_at: new Date().toISOString(),
            })
            .select("*")
            .single();

        if (insertError) {
            return NextResponse.json({
                success: false,
                message: insertError.message,
            });
        }

        result = data;
    }

    // 如果用户是教练且修改了昵称，同步更新 coaches 表的 name 字段
    if (authResult.user?.is_coach) {
        const coachSync: Record<string, any> = {};
        if (body.nickname !== undefined) coachSync.name = body.nickname;
        if (body.avatar_url !== undefined) coachSync.avatar_url = body.avatar_url;
        if (Object.keys(coachSync).length > 0) {
            const { error: coachUpdateError } = await supabase
                .from("coaches")
                .update({
                    ...coachSync,
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId);

            if (coachUpdateError) {
                console.error("同步教练信息失败:", coachUpdateError);
                // 不阻断流程，只记录错误
            }
        }
    }

    return NextResponse.json({
        success: true,
        message: "用户档案更新成功",
        data: result,
    });
}
