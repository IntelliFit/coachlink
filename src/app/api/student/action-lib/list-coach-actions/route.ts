import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ListCoachActionsResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * POST /api/student/action-lib/list-coach-actions
 * 获取学员订阅教练的动作库
 */
export async function POST() {
    try {
        // 检查用户登录
        const session = await getServerSession();
        const userId = session?.user?.id || null;

        if (!userId) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "用户未登录",
                data: null,
            }, { status: 401 });
        }

        // 查找学员的活跃订阅
        const { data: subscription, error: subError } = await supabase
            .from("coach_subscriptions")
            .select("coach_id, coaches(id, name, user_id)")
            .eq("student_id", userId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (subError || !subscription?.coaches) {
            return NextResponse.json<ApiData<ListCoachActionsResponseDto>>({
                success: true,
                message: "未找到活跃订阅",
                data: {
                    actions: [],
                    totalCount: 0,
                    coachId: null,
                    coachName: null,
                },
            });
        }

        const coachId = subscription.coach_id;
        const coachInfo = subscription.coaches as any;
        const coachName = coachInfo?.name || null;
        const coachUserId = coachInfo?.user_id;

        if (!coachUserId) {
            console.error("Coach user_id not found for coach_id:", coachId);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "教练信息异常",
                data: null,
            }, { status: 500 });
        }

        // 获取教练的动作库 (注意：coach_actions.coach_id 关联的是 users.id)
        const { data: actions, error: actionsError, count } = await supabase
            .from("coach_actions")
            .select("*", { count: "exact" })
            .eq("coach_id", coachUserId)
            .order("created_at", { ascending: false });

        if (actionsError) {
            console.error("获取教练动作库失败:", actionsError);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "获取教练动作库失败",
                data: null,
            }, { status: 500 });
        }

        // 获取学员自己的动作库名称列表，用于判断是否已添加
        const { data: studentActions } = await supabase
            .from("student_actions")
            .select("name")
            .eq("user_id", userId);

        const studentActionNames = new Set(
            studentActions?.map((a) => a.name) || [],
        );

        const enhancedActions = (actions || []).map((action) => ({
            ...action,
            isAdded: studentActionNames.has(action.name),
        }));

        return NextResponse.json<ApiData<ListCoachActionsResponseDto>>({
            success: true,
            message: "获取成功",
            data: {
                actions: enhancedActions,
                totalCount: count || 0,
                coachId,
                coachName,
            },
        });
    } catch (error) {
        console.error("获取教练动作库失败:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
