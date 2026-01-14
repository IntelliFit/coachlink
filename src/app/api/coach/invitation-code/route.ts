import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";

// 生成 8 位唯一邀请码
async function generateUniqueInvitationCode(): Promise<string> {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        let code = "";
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // 检查是否已存在
        const { data: existing } = await supabase
            .from("coaches")
            .select("id")
            .eq("invitation_code", code)
            .maybeSingle();

        if (!existing) {
            return code;
        }
        attempts++;
    }

    throw new Error("无法生成唯一邀请码，请重试");
}

interface InvitationCodeResponse {
    invitationCode: string;
    invitationMode: "exclusive" | "open";
    inviteUrl: string;
    inviteUrlExclusive: string;
    inviteUrlOpen: string;
    coach: {
        id: string;
        name: string;
        title: string | null;
        bio: string | null;
        avatarUrl: string | null;
        specialties: string[] | null;
        yearsExperience: number | null;
        totalStudents: number | null;
        rating: number | null;
    };
}

// GET - 获取当前教练的邀请码和设置
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "未登录" }, { status: 401 });
    }

    // 获取教练信息
    const { data: coach, error } = await supabase
        .from("coaches")
        .select("id, name, title, bio, avatar_url, specialties, years_experience, total_students, rating, invitation_code, invitation_mode")
        .eq("user_id", session.user.id)
        .single();

    if (error || !coach) {
        return NextResponse.json({ message: "您不是教练或无法获取教练信息" }, {
            status: 403,
        });
    }

    // 如果没有邀请码，自动生成一个
    let invitationCode = coach.invitation_code;
    if (!invitationCode) {
        invitationCode = await generateUniqueInvitationCode();
        await serviceRoleSupabase
            .from("coaches")
            .update({ invitation_code: invitationCode })
            .eq("id", coach.id);
    }

    // 使用请求的 origin 动态生成链接，支持本地开发
    const origin = req.headers.get("origin") || req.headers.get("host");
    const protocol = req.headers.get("x-forwarded-proto") ||
        (origin?.includes("localhost") ? "http" : "https");
    const baseUrl = origin
        ? `${protocol}://${origin.replace(/^https?:\/\//, "")}`
        : (process.env.NEXT_PUBLIC_APP_URL || "https://coachlink.cn");

    const inviteUrl = `${baseUrl}/register?invite=${invitationCode}`;

    return NextResponse.json<ApiData<InvitationCodeResponse>>({
        success: true,
        data: {
            invitationCode,
            invitationMode: coach.invitation_mode || "exclusive",
            inviteUrl,
            inviteUrlExclusive: `${inviteUrl}&im=exclusive`,
            inviteUrlOpen: `${inviteUrl}&im=open`,
            coach: {
                id: coach.id,
                name: coach.name,
                title: coach.title ?? null,
                bio: coach.bio ?? null,
                avatarUrl: coach.avatar_url ?? null,
                specialties: (coach as any).specialties ?? null,
                yearsExperience: (coach as any).years_experience ?? null,
                totalStudents: (coach as any).total_students ?? null,
                rating: (coach as any).rating ?? null,
            },
        },
    });
}

// POST - 重新生成邀请码
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "未登录" }, { status: 401 });
    }

    const { data: coach } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

    if (!coach) {
        return NextResponse.json({ message: "您不是教练" }, { status: 403 });
    }

    const newCode = await generateUniqueInvitationCode();

    const { error } = await serviceRoleSupabase
        .from("coaches")
        .update({ invitation_code: newCode })
        .eq("id", coach.id);

    if (error) {
        return NextResponse.json({ message: "生成失败，请重试" }, {
            status: 500,
        });
    }

    // 使用请求的 origin 动态生成链接
    const origin = req.headers.get("origin") || req.headers.get("host");
    const protocol = req.headers.get("x-forwarded-proto") ||
        (origin?.includes("localhost") ? "http" : "https");
    const baseUrl = origin
        ? `${protocol}://${origin.replace(/^https?:\/\//, "")}`
        : (process.env.NEXT_PUBLIC_APP_URL || "https://coachlink.cn");

    return NextResponse.json<
        ApiData<{ invitationCode: string; inviteUrl: string }>
    >({
        success: true,
        message: "邀请码已重新生成",
        data: {
            invitationCode: newCode,
            inviteUrl: `${baseUrl}/register?invite=${newCode}`,
        },
    });
}

// PATCH - 更新邀请模式
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "未登录" }, { status: 401 });
    }

    const { invitationMode } = await req.json();

    if (!["exclusive", "open"].includes(invitationMode)) {
        return NextResponse.json({ message: "邀请模式无效" }, { status: 400 });
    }

    const { data: coach } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

    if (!coach) {
        return NextResponse.json({ message: "您不是教练" }, { status: 403 });
    }

    const { error } = await serviceRoleSupabase
        .from("coaches")
        .update({ invitation_mode: invitationMode })
        .eq("id", coach.id);

    if (error) {
        return NextResponse.json({ message: "更新失败" }, { status: 500 });
    }

    return NextResponse.json<ApiData<{ invitationMode: string }>>({
        success: true,
        message: invitationMode === "exclusive"
            ? "已切换为专属模式"
            : "已切换为开放模式",
        data: { invitationMode },
    });
}
