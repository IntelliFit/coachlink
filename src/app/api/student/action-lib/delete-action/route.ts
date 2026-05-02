import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    DeleteStudentActionDto,
    DeleteStudentActionResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { countActionRefs } from "@/lib/actionRefs";

function extractVideoStoragePath(url?: string | null) {
    if (!url) return null;
    const storageUrl = process.env.NEXT_SUPABASE_URL || process.env.SUPABASE_URL || "";
    if (!storageUrl || !url.includes(storageUrl)) return null;
    const parts = url.split("/videos/");
    if (parts.length !== 2) return null;
    return parts[1].split("?")[0] || null;
}

export async function POST(req: Request) {
    const { id } = await req.json() as DeleteStudentActionDto;

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

    try {
        const actionSet = new Set([id]);
        const { data: instances, error: instError } = await supabase
            .from("coach_plan_instances")
            .select("id,training_days,student_id")
            .eq("student_id", userId);

        if (!instError && instances) {
            const hits = instances
                .map((item: any) => countActionRefs(item.training_days, actionSet))
                .filter((count) => count > 0);
            const matchCount = hits.reduce((sum, count) => sum + count, 0);

            if (matchCount > 0) {
                return NextResponse.json<ApiData<null>>({
                    success: false,
                    message: `该动作正在被你的训练计划引用（共 ${matchCount} 处），请先替换引用后再删除。`,
                    data: null,
                }, { status: 409 });
            }
        }
    } catch (error) {
        console.error("Error checking student action references:", error);
    }

    const { data: existingAction, error: fetchError } = await supabase
        .from("student_actions")
        .select("id, url")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

    if (fetchError || !existingAction) {
        return NextResponse.json({
            success: false,
            message: "动作不存在或无权访问",
        }, { status: 404 });
    }

    const previousStoragePath = extractVideoStoragePath(
        typeof (existingAction as any)?.url === "string" ? String((existingAction as any).url) : ""
    );

    if (previousStoragePath) {
        const { error: storageError } = await supabase.storage
            .from("videos")
            .remove([previousStoragePath]);
        if (storageError) {
            console.error("Error removing student action demo video:", storageError);
        }
    }

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
