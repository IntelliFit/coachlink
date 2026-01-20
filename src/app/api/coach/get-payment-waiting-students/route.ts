import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetPaymentWaitingStudentsDto,
    GetPaymentWaitingStudentsResponseDto,
} from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    let {} = await req.json() as GetPaymentWaitingStudentsDto;

    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

    if (coachError) {
        return NextResponse.json({
            success: false,
            message: coachError.message,
        });
    }

    // 查询需要手动确认的订阅：
    // 1. status = 'waiting'（传统流程）
    // 2. status = 'inactive' 且 payment_method 为空（学员创建订阅但未完成支付流程）
    const { data: manualSubscriptions, error: manualErr } = await supabase
        .from("coach_subscriptions")
        .select("*")
        .eq("coach_id", coach.id)
        .eq("status", "waiting")
        .order("created_at", { ascending: false });

    if (manualErr) {
        return NextResponse.json({
            success: false,
            message: manualErr.message,
        });
    }

    const { data: systemSubscriptions, error: systemErr } = await supabase
        .from("coach_subscriptions")
        .select("*")
        .eq("coach_id", coach.id)
        .eq("status", "active")
        .eq("payment_confirmed_by", "system")
        .is("coach_seen_at", null)
        .order("payment_confirmed_at", { ascending: false });

    if (systemErr) {
        return NextResponse.json({
            success: false,
            message: systemErr.message,
        });
    }

    // Platform payment pending (not paid yet): show as read-only notification in the same入口
    const { data: platformPending, error: pendingErr } = await supabase
        .from("coach_subscriptions")
        .select("*")
        .eq("coach_id", coach.id)
        .eq("status", "inactive")
        .eq("payment_method", "platform_alipay")
        .is("coach_seen_at", null)
        .not("order_id", "is", null)
        .order("created_at", { ascending: false });

    if (pendingErr) {
        return NextResponse.json({
            success: false,
            message: pendingErr.message,
        });
    }

    return NextResponse.json<ApiData<GetPaymentWaitingStudentsResponseDto>>({
        success: true,
        message: "获取定价信息成功",
        data: {
            manualSubscriptions: manualSubscriptions || [],
            systemSubscriptions: [
                ...(systemSubscriptions || []),
                ...(platformPending || []),
            ],
        },
    });
}
