import supabase from "@/lib/supabaseClient";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取请求数据
    const body = await request.json();

    // 准备要更新的数据
    const profileData: Record<string, any> = {
        full_name: body.full_name,
        nickname: body.nickname,
        phone: body.phone,
        address: body.address,
        gender: body.gender,
        birth_date: body.birth_date,
        height: body.height != null ? Number(body.height) : null,
        weight: body.weight != null ? Number(body.weight) : null,
        fitness_goal: body.fitness_goal,
        fitness_level: body.fitness_level,
        bio: body.bio,
        updated_at: new Date().toISOString(),
    };

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
    const { data: existingProfile, error: selectError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

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
    if (body.nickname && session.user.is_coach) {
        const { error: coachUpdateError } = await supabase
            .from("coaches")
            .update({
                name: body.nickname,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

        if (coachUpdateError) {
            console.error("同步教练名称失败:", coachUpdateError);
            // 不阻断流程，只记录错误
        }
    }

    return NextResponse.json({
        success: true,
        message: "用户档案更新成功",
        data: result,
    });
}
