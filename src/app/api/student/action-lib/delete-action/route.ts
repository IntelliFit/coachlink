import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    DeleteStudentActionDto,
    DeleteStudentActionResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { countActionRefs } from "@/lib/actionRefs";

export async function POST(req: Request) {
    const { id } = await req.json() as DeleteStudentActionDto;

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

    // 删除前：检查该动作是否被学员自己的计划实例引用
    try {
        const actionSet = new Set([id]);
        const { data: instances, error: instError } = await supabase
            .from("coach_plan_instances")
            .select("id,training_days,student_id")
            .eq("student_id", userId);

        if (!instError && instances) {
            const hits = instances.map((i: any) => countActionRefs(i.training_days, actionSet)).filter((c) => c > 0);
            const matchCount = hits.reduce((s, x) => s + x, 0);
            if (matchCount > 0) {
                return NextResponse.json<ApiData<null>>({
                    success: false,
                    message: `该动作正在被你的训练计划引用（共 ${matchCount} 处），请先替换引用后再删除。`,
                    data: null,
                }, { status: 409 });
            }
        }
    } catch (e) {
        console.error("检查引用异常:", e);
    }

    // 删除动作（确保只能删除自己的动作）
    const { error } = await supabase
        .from("student_actions")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

    if (error) {
        console.error("Error deleting student action:", error);
        return NextResponse.json({
            success: false,
            message: "删除动作失败",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<DeleteStudentActionResponseDto>>({
        success: true,
        message: "删除动作成功",
        data: {
            deleted: true,
        },
    });
}
