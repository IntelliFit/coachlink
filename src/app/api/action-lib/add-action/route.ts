import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import type { AddActionDto, AddActionResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const addData = await req.json() as AddActionDto;

    // Check if user is logged in and has coach role
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    // 基础字段验证
    if (!addData.name || !addData.name.trim()) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数（name 为必填项）",
        }, { status: 400 });
    }

    // 对于力量训练类型，positions 是必需的
    const itemType = (addData as any).type;
    // 只有明确是 STRENGTH 或未指定类型时才验证 positions
    const needsPositions = !itemType || itemType === "STRENGTH";
    const fallbackPositions = needsPositions && !addData.positions?.length
        ? ["其他"]
        : addData.positions;

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    // Insert new action
    const { data: action, error } = await supabase
        .from("coach_actions")
        .insert({
            coach_id: userId,
            ...addData,
            name: addData.name.trim(),
            detail: addData.detail?.trim() || null,
            positions: fallbackPositions ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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
            action,
        },
    });
}
