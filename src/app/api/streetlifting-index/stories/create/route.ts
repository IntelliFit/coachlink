import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingCreateStoryDto,
    StreetliftingCreateStoryResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = await req.json() as StreetliftingCreateStoryDto;

        if (!body?.title?.trim()) {
            return NextResponse.json<ApiData<StreetliftingCreateStoryResponseDto>>({
                success: false,
                message: "请填写标题",
                data: null,
            }, { status: 400 });
        }

        const db = serviceRoleSupabase;
        const { data, error } = await db
            .from("streetlifting_stories")
            .insert([{
                title: body.title.trim(),
                content: body.content || null,
                video_url: body.video_url || null,
                type: body.type || "story",
                event_date: body.event_date || null,
                user_contact: body.user_contact || null,
            }])
            .select("*")
            .single();

        if (error || !data) {
            console.error("[streetlifting-index][stories] create error:", error);
            return NextResponse.json<ApiData<StreetliftingCreateStoryResponseDto>>({
                success: false,
                message: error?.message || "提交失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingCreateStoryResponseDto>>({
            success: true,
            message: "提交成功",
            data: {
                story: data,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][stories] create error:", error);
        return NextResponse.json<ApiData<StreetliftingCreateStoryResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
