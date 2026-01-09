import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { CopyCoachActionDto, CopyCoachActionResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * POST /api/student/action-lib/copy-coach-action
 * 复制教练动作到学员自己的动作库
 */
export async function POST(req: Request) {
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

        const { coachActionId } = await req.json() as CopyCoachActionDto;

        if (!coachActionId) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "缺少 coachActionId",
                data: null,
            }, { status: 400 });
        }

        // 查找学员的活跃订阅
        const { data: subscription, error: subError } = await supabase
            .from("coach_subscriptions")
            .select("coach_id, coaches(user_id)")
            .eq("student_id", userId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (subError || !subscription?.coach_id || !subscription?.coaches) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "未找到活跃订阅，无法复制教练动作",
                data: null,
            }, { status: 403 });
        }

        const coachUserId = (subscription.coaches as any).user_id;

        // 获取教练动作详情 (注意：coach_actions.coach_id 关联的是 users.id)
        const { data: coachAction, error: actionError } = await supabase
            .from("coach_actions")
            .select("*")
            .eq("id", coachActionId)
            .eq("coach_id", coachUserId)
            .single();

        if (actionError || !coachAction) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "未找到该教练动作或无权访问",
                data: null,
            }, { status: 404 });
        }

        // 检查是否已复制过此动作（通过 canonical_action_id 或名称检查）
        const { data: existingAction } = await supabase
            .from("student_actions")
            .select("id")
            .eq("user_id", userId)
            .eq("name", coachAction.name)
            .limit(1)
            .single();

        if (existingAction) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "您已有同名动作，无需重复添加",
                data: null,
            }, { status: 409 });
        }

        // 创建学员动作（复制属性）
        // 使用 as any 处理新字段，绕过类型检查（待数据库类型重新生成后可移除）
        const insertData: any = {
            user_id: userId,
            name: coachAction.name,
            detail: coachAction.detail,
            positions: coachAction.positions,
            attrs: coachAction.attrs,
            url: coachAction.url,
            enableAutoWeightCompute: coachAction.enableAutoWeightCompute,
            includesBodyWeight: coachAction.includesBodyWeight,
        };

        // 添加可能不存在的新字段
        if ((coachAction as any).type) {
            insertData.type = (coachAction as any).type;
        }
        if ((coachAction as any).canonical_action_id) {
            insertData.canonical_action_id =
                (coachAction as any).canonical_action_id;
        }
        if ((coachAction as any).item_schema) {
            insertData.item_schema = (coachAction as any).item_schema;
        }
        if ((coachAction as any).suggested_time) {
            insertData.suggested_time = (coachAction as any).suggested_time;
        }

        const { data: newAction, error: insertError } = await supabase
            .from("student_actions")
            .insert(insertData)
            .select()
            .single();

        if (insertError) {
            console.error("复制动作失败:", insertError);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "复制动作失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<CopyCoachActionResponseDto>>({
            success: true,
            message: "已成功添加到您的动作库",
            data: {
                action: newAction,
            },
        });
    } catch (error) {
        console.error("复制教练动作失败:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
