import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetSettingsDto,
    GetSettingsResponseDto,
    UpdateSettingDto,
    UpdateSettingResponseDto,
} from "./entity";

// 获取平台设置
export async function GET(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.is_admin) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "需要管理员权限",
            data: null,
        }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    let query = supabase.from("platform_settings").select("*");

    if (key) {
        query = query.eq("key", key);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message,
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<GetSettingsResponseDto>>({
        success: true,
        message: "获取成功",
        data: {
            settings: data || [],
        },
    });
}

// 更新平台设置
export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.is_admin) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "需要管理员权限",
            data: null,
        }, { status: 403 });
    }

    const { key, value } = await req.json() as UpdateSettingDto;

    if (!key) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "缺少配置项 key",
            data: null,
        }, { status: 400 });
    }

    // 使用 upsert 确保配置项存在则更新，不存在则创建
    const { data, error } = await supabase
        .from("platform_settings")
        .upsert({
            key,
            value,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: "key",
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message,
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<UpdateSettingResponseDto>>({
        success: true,
        message: "更新成功",
        data: {
            setting: data,
        },
    });
}
