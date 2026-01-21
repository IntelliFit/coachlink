import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    UpdateStudentActionDto,
    UpdateStudentActionResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { StudentActionRow } from "@/types/student";

export async function POST(req: Request) {
    const { id, ...updateData } = await req.json() as UpdateStudentActionDto;

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    if (!id) {
        return NextResponse.json({
            success: false,
            message: "缺少动作ID",
        }, { status: 400 });
    }

    // 更新动作（确保只能更新自己的动作）
    console.log("[API] update-action data:", updateData);
    const nextType = updateData.type;
    const sanitizedUpdateData: Record<string, unknown> = { ...updateData };
    // 当明确传入 type 时，按类型纠正/清理不相关字段，避免脏数据残留
    if (nextType && nextType !== "STRENGTH") {
        sanitizedUpdateData.positions = null;
        sanitizedUpdateData.attrs = null;
        sanitizedUpdateData.enableAutoWeightCompute = false;
        sanitizedUpdateData.includesBodyWeight = false;
        sanitizedUpdateData.canonical_action_id = null;
        sanitizedUpdateData.suggested_time = nextType === "DIET" ? ((updateData as any).suggested_time || null) : null;
    } else if (nextType && nextType === "STRENGTH") {
        // 力量训练不使用 suggested_time
        sanitizedUpdateData.suggested_time = null;
        // includesBodyWeight 只有在启用自动计算时才有意义
        if (!(updateData.enableAutoWeightCompute || false)) {
            sanitizedUpdateData.includesBodyWeight = false;
        }
    }

    const { data: action, error } = await supabase
        .from("student_actions")
        .update({
            ...sanitizedUpdateData,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) {
        console.error("Error updating student action:", error);
        return NextResponse.json({
            success: false,
            message: "更新动作失败",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<UpdateStudentActionResponseDto>>({
        success: true,
        message: "更新动作成功",
        data: {
            action: action as unknown as StudentActionRow,
        },
    });
}
