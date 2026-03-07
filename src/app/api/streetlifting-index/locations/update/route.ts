import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingUpdateLocationDto,
    StreetliftingUpdateLocationResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = (await req.json().catch(() => ({}))) as StreetliftingUpdateLocationDto;

        if (!body?.id) {
            return NextResponse.json<ApiData<StreetliftingUpdateLocationResponseDto>>({
                success: false,
                message: "缺少地点ID",
                data: null,
            }, { status: 400 });
        }

        const db = serviceRoleSupabase;
        const { data, error } = await db
            .from("streetlifting_locations")
            .update({
                name: body.name,
                description: body.description ?? null,
                address: body.address ?? null,
                city: body.city ?? null,
                province: body.province ?? null,
                county: body.county ?? null,
                latitude: body.latitude ?? null,
                longitude: body.longitude ?? null,
                image_urls: body.image_urls?.length ? body.image_urls : null,
                user_contact: body.user_contact ?? null,
            })
            .eq("id", body.id)
            .select("*")
            .single();

        if (error || !data) {
            console.error("[streetlifting-index][locations] update error:", error);
            return NextResponse.json<ApiData<StreetliftingUpdateLocationResponseDto>>({
                success: false,
                message: error?.message || "更新失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingUpdateLocationResponseDto>>({
            success: true,
            message: "更新成功",
            data: {
                location: data,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][locations] update error:", error);
        return NextResponse.json<ApiData<StreetliftingUpdateLocationResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
