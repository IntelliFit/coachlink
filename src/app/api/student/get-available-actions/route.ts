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

        const currentUserId = session.user.id;
        const body = await request.json().catch(() => ({}));
        const { coachId, targetUserId } = body as {
            coachId?: string;
            targetUserId?: string;
        };

        // Resolve query user (support coach -> student)
        let userId = currentUserId;
        if (targetUserId && targetUserId !== currentUserId) {
            // Verify current user is coach of this student
            const { data: isCoach } = await supabase
                .from("coach_subscriptions")
                .select(
                    `
                    id,
                    coaches!inner(user_id)
                `,
                )
                .eq("coaches.user_id", currentUserId)
                .eq("student_id", targetUserId)
                .maybeSingle();

            if (!isCoach) {
                return NextResponse.json<ApiData<null>>(
                    {
                        success: false,
                        message: "无权查看该用户的动作列表",
                        data: null,
                    },
                    { status: 403 },
                );
            }

            userId = targetUserId;
        }

        // Get distinct actions from personal_records_history - strictly by action_id
        // If coachId is provided, filter by source_coach_id to get coach-specific actions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let queryBuilder: any = supabase
            .from("personal_records_history")
            .select("action_id, exercise_name")
            .eq("user_id", userId)
            .not("action_id", "is", null); // Only include records with action_id

        // Filter by coach if provided
        if (coachId) {
            queryBuilder = queryBuilder.eq("source_coach_id", coachId);
        }

        let { data: prActions, error: prError } = await queryBuilder.order(
            "created_at",
            { ascending: false },
        );

        // Fallback: If filtering by coachId returned no results, try without filter
        // This handles legacy data that doesn't have source_coach_id populated
        if (!prError && (!prActions || prActions.length === 0) && coachId) {
            console.log(
                "No records with source_coach_id, falling back to all user records",
            );
            const fallbackQuery = supabase
                .from("personal_records_history")
                .select("action_id, exercise_name")
                .eq("user_id", userId)
                .not("action_id", "is", null)
                .order("created_at", { ascending: false });

            const fallbackResult = await fallbackQuery;
            prActions = fallbackResult.data;
            prError = fallbackResult.error;
        }

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
