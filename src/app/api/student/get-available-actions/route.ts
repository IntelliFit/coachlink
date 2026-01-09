import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

export interface AvailableAction {
    actionId: string;
    actionName: string;
}

export interface GetAvailableActionsResponseDto {
    actions: AvailableAction[];
}

/**
 * POST /api/student/get-available-actions
 *
 * Get list of actions that the current user has e1RM/PR history for.
 * Returns distinct actions from personal_records_history, strictly by action_id.
 */
export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;

        // Get distinct actions from personal_records_history - strictly by action_id
        const { data: prActions, error: prError } = await supabase
            .from("personal_records_history")
            .select("action_id, exercise_name")
            .eq("user_id", userId)
            .not("action_id", "is", null) // Only include records with action_id
            .order("created_at", { ascending: false });

        if (prError) {
            console.error("获取动作列表失败:", prError);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "获取动作列表失败",
                data: null,
            }, { status: 500 });
        }

        // Deduplicate strictly by action_id (same action_id = same action)
        const actionMap = new Map<string, AvailableAction>();

        if (prActions) {
            for (const record of prActions) {
                const id = record.action_id;
                if (id && !actionMap.has(id)) {
                    actionMap.set(id, {
                        actionId: id,
                        actionName: record.exercise_name || "未知动作",
                    });
                }
            }
        }

        const actions = Array.from(actionMap.values());

        return NextResponse.json<ApiData<GetAvailableActionsResponseDto>>({
            success: true,
            message: "获取成功",
            data: { actions },
        });
    } catch (error) {
        console.error("获取动作列表失败:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
