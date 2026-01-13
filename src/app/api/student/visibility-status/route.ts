import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";

interface VisibilityStatus {
    // 是否处于专注模式（只能看到绑定教练的内容）
    focusMode: boolean;
    // 专注的教练 ID（当前有活跃订阅的教练，且该教练设置了 exclusive 模式）
    focusCoachId: string | null;
    // 专注的教练名称
    focusCoachName: string | null;
    // 邀请人教练 ID（注册时通过邀请码关联的教练）
    referrerCoachId: string | null;
    // 邀请人教练名称
    referrerCoachName: string | null;
}

// GET - 获取当前用户的视野状态
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "未登录" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. 获取用户的邀请来源教练
    const { data: userData } = await supabase
        .from("users")
        .select("referrer_coach_id")
        .eq("id", userId)
        .single();

    let referrerCoachId: string | null = null;
    let referrerCoachName: string | null = null;

    if (userData?.referrer_coach_id) {
        const { data: referrerCoach } = await supabase
            .from("coaches")
            .select("id, name")
            .eq("id", userData.referrer_coach_id)
            .single();

        if (referrerCoach) {
            referrerCoachId = referrerCoach.id;
            referrerCoachName = referrerCoach.name;
        }
    }

    // 2. 获取用户当前活跃的教练订阅
    const { data: activeSubscriptions } = await supabase
        .from("coach_subscriptions")
        .select(`
            id,
            coach_id,
            status,
            end_date
        `)
        .eq("student_id", userId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString());

    let focusMode = false;
    let focusCoachId: string | null = null;
    let focusCoachName: string | null = null;

    // 3. 检查是否有活跃订阅，并且该教练设置了 exclusive 模式
    if (activeSubscriptions && activeSubscriptions.length > 0) {
        // 获取第一个活跃订阅的教练信息（通常学员只会有一个活跃订阅）
        const subscription = activeSubscriptions[0];

        const { data: coach } = await supabase
            .from("coaches")
            .select("id, name, invitation_mode")
            .eq("id", subscription.coach_id)
            .single();

        if (coach) {
            // 只有当教练设置了 exclusive 模式时，才启用专注模式
            if (coach.invitation_mode === "exclusive") {
                focusMode = true;
                focusCoachId = coach.id;
                focusCoachName = coach.name;
            }
        }
    }

    // 4. 如果没有活跃订阅，但有邀请来源教练，检查是否应该进入专注模式
    // （针对注册后尚未订阅的场景）
    if (!focusMode && referrerCoachId) {
        const { data: referrerCoach } = await supabase
            .from("coaches")
            .select("id, name, invitation_mode")
            .eq("id", referrerCoachId)
            .single();

        if (referrerCoach && referrerCoach.invitation_mode === "exclusive") {
            // 学员尚未订阅，但通过专属模式教练邀请注册，也启用专注模式
            focusMode = true;
            focusCoachId = referrerCoach.id;
            focusCoachName = referrerCoach.name;
        }
    }

    return NextResponse.json<ApiData<VisibilityStatus>>({
        success: true,
        data: {
            focusMode,
            focusCoachId,
            focusCoachName,
            referrerCoachId,
            referrerCoachName,
        },
    });
}
