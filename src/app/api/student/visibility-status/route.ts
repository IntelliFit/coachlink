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
        .select("referrer_coach_id, invited_visibility_mode")
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

    let focusMode = false;
    let focusCoachId: string | null = null;
    let focusCoachName: string | null = null;

    // 2. 只对“通过教练邀请链接注册”的学员启用私域（referrer_coach_id 有值）
    //    非邀请注册的学员，即使有订阅，也应保持公域视野（可发现其他教练）。
    if (referrerCoachId) {
        const { data: referrerCoach } = await supabase
            .from("coaches")
            .select("id, name, invitation_mode")
            .eq("id", referrerCoachId)
            .single();

        const userOverride = (userData as any)?.invited_visibility_mode as
            | "exclusive"
            | "open"
            | null
            | undefined;
        const effectiveMode =
            userOverride === "exclusive" || userOverride === "open"
                ? userOverride
                : ((referrerCoach as any)?.invitation_mode as "exclusive" | "open" | null | undefined);

        if (referrerCoach && effectiveMode === "exclusive") {
            // 通过专属模式教练邀请注册：启用专注模式（只看邀请教练）
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
