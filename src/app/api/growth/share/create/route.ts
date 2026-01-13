import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { CreateGrowthShareDto, CreateGrowthShareResponseDto } from "./entity";

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const userId = session.user.id;
    const body = (await request.json().catch(() => ({}))) as CreateGrowthShareDto;
    const executionId = body.executionId || null;

    // Base URL: prefer env; fallback to request headers
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host");
    const proto = forwardedProto || "http";
    const inferredBaseUrl = host ? `${proto}://${host}` : "http://localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || inferredBaseUrl;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from("growth_share_links")
            .insert({
                creator_user_id: userId,
                execution_id: executionId,
                expires_at: expiresAt.toISOString(),
                meta: { channel: "share_card" },
            })
            .select("id, expires_at")
            .single();

        if (error || !data?.id) {
            console.error("Failed to create growth_share_links:", error);
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "创建分享链接失败（请确认已应用 supabase 迁移：20260113_add_growth_share_tracking.sql）",
                    data: null,
                },
                { status: 500 },
            );
        }

        const shareId = data.id as string;
        const acquisitionUrl = `${baseUrl}/s/${shareId}`;

        return NextResponse.json<ApiData<CreateGrowthShareResponseDto>>({
            success: true,
            message: "创建分享链接成功",
            data: {
                shareId,
                acquisitionUrl,
                expiresAt: data.expires_at || expiresAt.toISOString(),
            },
        });
    } catch (e) {
        console.error("Create growth share failed:", e);
        return NextResponse.json(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

