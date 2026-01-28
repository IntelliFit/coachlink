import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingCreateLocationDto,
    StreetliftingCreateLocationResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = await req.json() as StreetliftingCreateLocationDto;

        if (!body?.name?.trim()) {
            return NextResponse.json<ApiData<StreetliftingCreateLocationResponseDto>>({
                success: false,
                message: "请填写地点名称",
                data: null,
            }, { status: 400 });
        }

        const db = serviceRoleSupabase;
        const { data, error } = await db
            .from("streetlifting_locations")
            .insert([{
                name: body.name.trim(),
                description: body.description || null,
                address: body.address || null,
                city: body.city || null,
                province: body.province || null,
                image_urls: body.image_urls?.length ? body.image_urls : null,
                user_contact: body.user_contact || null,
            }])
            .select("*")
            .single();

        if (error || !data) {
            console.error("[streetlifting-index][locations] create error:", error);
            return NextResponse.json<ApiData<StreetliftingCreateLocationResponseDto>>({
                success: false,
                message: error?.message || "提交失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingCreateLocationResponseDto>>({
            success: true,
            message: "提交成功",
            data: {
                location: data,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][locations] create error:", error);
        return NextResponse.json<ApiData<StreetliftingCreateLocationResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
