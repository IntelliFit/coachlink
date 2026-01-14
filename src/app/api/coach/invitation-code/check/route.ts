import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import { CheckInvitationCodeAvailabilityDto, CheckInvitationCodeAvailabilityResponseDto } from "./entity";

// POST - 检查邀请码是否已被注册
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "未登录" }, { status: 401 });
    }

    // 验证用户是否为教练
    const { data: coach, error } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (error || !coach) {
        return NextResponse.json({ message: "您不是教练" }, { status: 403 });
    }

    const { invitationCode }: CheckInvitationCodeAvailabilityDto = await req.json();

    // 验证邀请码参数
    if (!invitationCode || typeof invitationCode !== 'string') {
        return NextResponse.json({ message: "邀请码参数无效" }, { status: 400 });
    }

    // 检查邀请码是否已被其他教练使用
    const { data: existing, error: queryError } = await supabase
        .from("coaches")
        .select("id")
        .eq("invitation_code", invitationCode)
        .maybeSingle();

    if (queryError) {
        return NextResponse.json({ message: "查询失败" }, { status: 500 });
    }

    const responseData: CheckInvitationCodeAvailabilityResponseDto = {
        available: !existing,
        message: existing 
            ? "该邀请码已被使用" 
            : "该邀请码可用"
    };

    return NextResponse.json<ApiData<CheckInvitationCodeAvailabilityResponseDto>>({
        success: true,
        data: responseData,
    });
}