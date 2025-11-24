import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { AddActionDto, AddActionResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const {
        name,
        detail,
        url = '',
        positions = [],
    } = await req.json() as AddActionDto;

    // Check if user is logged in and has coach role
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!name || !detail || !positions?.length) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数"
        }, { status: 400 });
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_coach')
        .eq('id', userId)
        .single();

    if (userError || !user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    // Insert new action
    const { data: action, error } = await supabase
        .from('coach_actions')
        .insert({
            name,
            detail,
            url,
            positions,
            coach_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error("Error adding action:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to add action",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<AddActionResponseDto>>({
        success: true,
        message: "添加动作成功",
        data: {
            action
        }
    });
}
