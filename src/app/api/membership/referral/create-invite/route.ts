import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { ApiData } from "@/types/api";

export interface InviteInfo {
    inviteCode: string;
    inviteLink: string;
    shareText: string;
}

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;
    // For MVP, we use userId as the invite code.
    // In future, we can generate a short alphanumeric code and store it in user_profiles.
    const inviteCode = userId;

    // Prefer explicit base URL; otherwise infer from request headers to avoid leaking localhost in production.
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host");
    const proto = forwardedProto || "http";
    const inferredBaseUrl = host ? `${proto}://${host}` : "http://localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || inferredBaseUrl;
    const inviteLink = `${baseUrl}/register?ref=${inviteCode}`;

    const shareText =
        `来 CoachLink 和我一起科学训练！注册即送智能导入次数 + 存储空间奖励，点击链接加入：${inviteLink}`;

    return NextResponse.json<ApiData<InviteInfo>>({
        success: true,
        message: "获取邀请信息成功",
        data: {
            inviteCode,
            inviteLink,
            shareText,
        },
    });
}
