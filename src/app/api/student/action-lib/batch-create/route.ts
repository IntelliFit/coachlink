import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import {
    BatchCreateStudentActionsDto,
    BatchCreateStudentActionsResponseDto,
} from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 批量创建学员动作
 * 用于智能导入时快速创建多个新动作
 */
export async function POST(req: Request) {
    const { actions } = await req.json() as BatchCreateStudentActionsDto;

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!actions || actions.length === 0) {
        return NextResponse.json({
            success: false,
            message: "请提供要创建的动作列表",
        }, { status: 400 });
    }

    try {
        // 批量插入学员动作（学员动作表不包含自动计算相关字段）
        const actionsToInsert = actions.map((action) => ({
            user_id: userId,
            name: action.name,
            detail: `智能导入创建的动作: ${action.name}`,
            positions: ["全身"], // 默认位置
            attrs: ["组数", "次数", "强度", "休息时间"], // 默认属性
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));

        const { data: createdActions, error } = await serviceRoleSupabase
            .from("student_actions")
            .insert(actionsToInsert)
            .select();

        if (error) {
            console.error("Error creating student actions:", error);
            return NextResponse.json({
                success: false,
                message: "创建动作失败: " + error.message,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<BatchCreateStudentActionsResponseDto>>(
            {
                success: true,
                message: `成功创建 ${createdActions?.length || 0} 个动作`,
                data: {
                    createdActions: createdActions || [],
                },
            },
        );
    } catch (error) {
        console.error("Error batch creating student actions:", error);
        return NextResponse.json({
            success: false,
            message: "批量创建动作失败",
        }, { status: 500 });
    }
}
