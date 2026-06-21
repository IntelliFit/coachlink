import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";

export interface ReferralStatsResponseDto {
    invites: number;
    rewardedAi: number;
    rewardedStorageMb: number;
}

async function handle(request: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(request);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const inviterId = authResult.userId;

    const { data: rows, error } = await supabase
        .from("referral_rewards")
        .select("reward_granted, status")
        .eq("inviter_id", inviterId);

    if (error) {
        console.error("Failed to fetch referral stats:", error);
        return NextResponse.json(
            { success: false, message: "获取邀请统计失败", data: null },
            { status: 500 },
        );
    }

    const invites = (rows || []).length;
    const rewardedAi = (rows || []).reduce((sum, r: any) => {
        const v = r?.reward_granted?.ai_import;
        return sum + (typeof v === "number" ? v : 0);
    }, 0);
    const rewardedStorageMb = (rows || []).reduce((sum, r: any) => {
        const v = r?.reward_granted?.storage_mb;
        return sum + (typeof v === "number" ? v : 0);
    }, 0);

    return NextResponse.json<ApiData<ReferralStatsResponseDto>>({
        success: true,
        message: "获取邀请统计成功",
        data: { invites, rewardedAi, rewardedStorageMb },
    });
}

export async function GET(request: Request) {
    return handle(request);
}

export async function POST(request: Request) {
    return handle(request);
}
