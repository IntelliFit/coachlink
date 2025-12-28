import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { BatchCreateActionsDto, BatchCreateActionsResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 批量创建动作
 * 用于智能导入时快速创建多个新动作
 */
export async function POST(req: Request) {
    const { actions } = await req.json() as BatchCreateActionsDto;

    // 检查用户登录和教练权限
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
        .from("users")
        .select("is_coach")
        .eq("id", userId)
        .single();

    if (userError || !user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    if (!actions || actions.length === 0) {
        return NextResponse.json({
            success: false,
            message: "请提供要创建的动作列表",
        }, { status: 400 });
    }

    try {
        // 批量插入动作
        const actionsToInsert = actions.map((action) => ({
            coach_id: userId,
            name: action.name,
            detail: `智能导入创建的动作: ${action.name}`,
            positions: ["全身"], // 默认位置
            attrs: ["组数", "次数", "强度", "休息时间"], // 默认属性
            enableAutoWeightCompute: action.needsAutoCompute,
            includesBodyWeight: action.includesBodyWeight,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));

        const { data: createdActions, error } = await supabase
            .from("coach_actions")
            .insert(actionsToInsert)
            .select();

        if (error) {
            console.error("Error creating actions:", error);
            return NextResponse.json({
                success: false,
                message: "创建动作失败",
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<BatchCreateActionsResponseDto>>({
            success: true,
            message: `成功创建 ${createdActions?.length || 0} 个动作`,
            data: {
                createdActions: createdActions || [],
            },
        });
    } catch (error) {
        console.error("Error batch creating actions:", error);
        return NextResponse.json({
            success: false,
            message: "批量创建动作失败",
        }, { status: 500 });
    }
}
