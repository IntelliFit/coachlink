import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

interface GetStudentActionsDto {
    subscriptionId: string;
}

export async function POST(req: Request) {
    const { subscriptionId } = await req.json() as GetStudentActionsDto;

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    if (!subscriptionId) {
        return NextResponse.json({
            success: false,
            message: "缺少订阅ID",
        }, { status: 400 });
    }

    // 验证教练权限
    const { data: subscription, error: subError } = await supabase
        .from("coach_subscriptions")
        .select("coach_id, student_id, coaches(user_id)")
        .eq("id", subscriptionId)
        .single();

    if (subError || !subscription) {
        return NextResponse.json({
            success: false,
            message: "订阅不存在",
        }, { status: 404 });
    }

    const coachInfo = subscription.coaches as any;
    if (coachInfo?.user_id !== userId) {
        return NextResponse.json({
            success: false,
            message: "无权限访问",
        }, { status: 403 });
    }

    const studentId = subscription.student_id as string | null;
    if (!studentId) {
        return NextResponse.json({
            success: false,
            message: "学员ID不存在",
        }, { status: 400 });
    }

    // 获取学员动作库
    const { data: actions, error: actionsError } = await supabase
        .from("student_actions")
        .select("*")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false });

    if (actionsError) {
        console.error("Error fetching student actions:", actionsError);
        return NextResponse.json({
            success: false,
            message: "获取学员动作库失败",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<{ actions: any[] }>>({
        success: true,
        message: "获取成功",
        data: {
            actions: actions || [],
        },
    });
}

