import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";

/**
 * POST /api/action-lib/link-canonical
 * 关联或取消关联公共动作
 */
export async function POST(request: NextRequest) {
    try {
        // 验证用户身份
        const { data: { user }, error: authError } = await supabase.auth
            .getUser();
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: "未授权" },
                { status: 401 },
            );
        }

        const body = await request.json();
        const { actionId, canonicalActionId, actionType = "coach" } = body;

        if (!actionId) {
            return NextResponse.json(
                { success: false, error: "缺少 actionId" },
                { status: 400 },
            );
        }

        // 根据类型选择表
        const tableName = actionType === "student"
            ? "student_actions"
            : "coach_actions";
        const ownerColumn = actionType === "student" ? "user_id" : "coach_id";

        // 验证动作归属
        const { data: action, error: fetchError } = await supabase
            .from(tableName)
            .select("id")
            .eq("id", actionId)
            .eq(ownerColumn, user.id)
            .single();

        if (fetchError || !action) {
            return NextResponse.json(
                { success: false, error: "动作不存在或无权限" },
                { status: 404 },
            );
        }

        // 如果提供了 canonicalActionId，验证其存在
        if (canonicalActionId) {
            const { data: canonical, error: canonicalError } = await supabase
                .from("canonical_actions")
                .select("id")
                .eq("id", canonicalActionId)
                .single();

            if (canonicalError || !canonical) {
                return NextResponse.json(
                    { success: false, error: "公共动作不存在" },
                    { status: 404 },
                );
            }
        }

        // 更新关联
        const { error: updateError } = await supabase
            .from(tableName)
            .update({ canonical_action_id: canonicalActionId || null })
            .eq("id", actionId);

        if (updateError) {
            console.error("Error updating canonical link:", updateError);
            return NextResponse.json(
                { success: false, error: updateError.message },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            message: canonicalActionId ? "已关联公共动作" : "已取消关联",
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json(
            { success: false, error: "服务器内部错误" },
            { status: 500 },
        );
    }
}
