import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    TrackGrowthShareEventDto,
    TrackGrowthShareEventResponseDto,
} from "./entity";

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as
        | TrackGrowthShareEventDto
        | null;

    if (!body?.shareId || !body?.eventType) {
        return NextResponse.json(
            { success: false, message: "缺少参数", data: null },
            { status: 400 },
        );
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from("growth_share_events").insert({
            share_id: body.shareId,
            event_type: body.eventType,
            meta: body.meta || {},
        });

        if (error) {
            console.warn("Failed to track growth share event:", error);
            return NextResponse.json<ApiData<TrackGrowthShareEventResponseDto>>(
                {
                    success: false,
                    message:
                        "记录事件失败（请确认已应用 supabase 迁移：20260113_add_growth_share_tracking.sql）",
                    data: { shareId: body.shareId, ok: false },
                },
                { status: 500 },
            );
        }

        return NextResponse.json<ApiData<TrackGrowthShareEventResponseDto>>({
            success: true,
            message: "ok",
            data: { shareId: body.shareId, ok: true },
        });
    } catch (e) {
        console.warn("Track growth share event failed:", e);
        return NextResponse.json(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}

