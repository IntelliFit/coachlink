import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetExecutionDto,
    GetExecutionResponseDto,
} from "./entity";
import { buildShareInfo } from "../share-helper";
import type { ShareInfoResponseDto } from "../entity";
import { validateExecutionSubscriptionAccess } from "../_helpers/subscriptionAccess";

/**
 * POST /api/execution/get
 *
 * 获取执行记录 (mode=share 返回分享卡片数据)
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<GetExecutionResponseDto>>({
                success: false,
                message: "未登录",
                data: null,
            }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await req.json() as GetExecutionDto;
        const { id: executionId, mode } = body;

        if (!executionId) {
            return NextResponse.json<ApiData<GetExecutionResponseDto>>({
                success: false,
                message: "缺少执行ID",
                data: null,
            }, { status: 400 });
        }

        // Share mode - return data for share card
        if (mode === "share") {
            const result = await buildShareInfo(executionId, userId);
            return NextResponse.json<ApiData<ShareInfoResponseDto>>(result.body, {
                status: result.status,
            });
        }

        // Default mode - return basic execution data
        const { data, error } = await supabase
            .from("plan_instance_executions")
            .select("*")
            .eq("id", executionId)
            .single();

        if (error || !data) {
            return NextResponse.json<ApiData<GetExecutionResponseDto>>({
                success: false,
                message: "记录不存在",
                data: null,
            }, { status: 404 });
        }

        if (data.student_id !== userId) {
            return NextResponse.json<ApiData<GetExecutionResponseDto>>({
                success: false,
                message: "无权限",
                data: null,
            }, { status: 403 });
        }

        const accessDecision = await validateExecutionSubscriptionAccess({
            instanceId: data.instance_id,
            studentId: userId,
            dayIndex: data.day_index,
        });
        if (!accessDecision.allowed) {
            return NextResponse.json<ApiData<GetExecutionResponseDto>>({
                success: false,
                message: accessDecision.message || "无权访问此计划",
                data: null,
            }, { status: accessDecision.status });
        }

        return NextResponse.json<ApiData<GetExecutionResponseDto>>({
            success: true,
            message: "获取成功",
            data: {
                id: data.id,
                instance_id: data.instance_id,
                student_id: data.student_id,
                dayIndex: data.day_index,
                status: data.status,
                action_executions: data.action_executions as any[],
                total_sets: data.total_sets,
                completed_sets: data.completed_sets,
                session_notes: data.session_notes,
                started_at: data.started_at,
                completed_at: data.completed_at,
            },
        });
    } catch (error) {
        console.error("获取执行记录失败:", error);
        return NextResponse.json<ApiData<GetExecutionResponseDto>>({
            success: false,
            message: "服务器错误",
            data: null,
        }, { status: 500 });
    }
}
