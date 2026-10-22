import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { mapLegacySubscriptionToPaymentRecord, mapSubscriptionOrderToPaymentRecord } from "@/lib/coachPaymentRecords";
import { isSubscriptionOrderTableMissingError } from "@/lib/subscriptionOrders";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
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
        .select("id")
        .eq("user_id", session.user.id)
        .single();

    if (coachError) {
        return NextResponse.json({
            success: false,
            message: coachError.message,
        });
    }

    // 四条列表查询只依赖 coach.id，并行发起；错误按原先的先后顺序检查
    const [
        { data: manualOrders, error: manualOrderErr },
        { data: systemOrders, error: systemOrderErr },
        { data: manualSubscriptions, error: manualErr },
        { data: systemSubscriptions, error: systemErr },
    ] = await Promise.all([
        serviceRoleSupabase
            .from("coach_subscription_orders" as any)
            .select("*")
            .eq("coach_id", coach.id)
            .eq("status", "pending_confirmation")
            .order("created_at", { ascending: false }),
        serviceRoleSupabase
            .from("coach_subscription_orders" as any)
            .select("*")
            .eq("coach_id", coach.id)
            .eq("status", "paid")
            .eq("payment_confirmed_by", "system")
            .is("coach_seen_at", null)
            .order("payment_confirmed_at", { ascending: false }),
        supabase
            .from("coach_subscriptions")
            .select("*")
            .eq("coach_id", coach.id)
            .eq("status", "waiting")
            .order("created_at", { ascending: false }),
        supabase
            .from("coach_subscriptions")
            .select("*")
            .eq("coach_id", coach.id)
            .eq("status", "active")
            .eq("payment_confirmed_by", "system")
            .is("coach_seen_at", null)
            .order("payment_confirmed_at", { ascending: false }),
    ]);

    if (manualOrderErr && !isSubscriptionOrderTableMissingError(manualOrderErr.message)) {
        return NextResponse.json({
            success: false,
            message: manualOrderErr.message,
        });
    }

    if (systemOrderErr && !isSubscriptionOrderTableMissingError(systemOrderErr.message)) {
        return NextResponse.json({
            success: false,
            message: systemOrderErr.message,
        });
    }

    if (manualErr) {
        return NextResponse.json({
            success: false,
            message: manualErr.message,
        });
    }

    if (systemErr) {
        return NextResponse.json({
            success: false,
            message: systemErr.message,
        });
    }

    return NextResponse.json<ApiData<GetPaymentWaitingStudentsResponseDto>>({
        success: true,
        message: "获取待支付确认列表成功",
        data: {
            manualSubscriptions: [
                ...((manualOrders || []).map(mapSubscriptionOrderToPaymentRecord)),
                ...((manualSubscriptions || []).map(mapLegacySubscriptionToPaymentRecord)),
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
            systemSubscriptions: [
                ...((systemOrders || []).map(mapSubscriptionOrderToPaymentRecord)),
                ...((systemSubscriptions || []).map(mapLegacySubscriptionToPaymentRecord)),
            ].sort((a, b) => {
                const aTime = new Date(a.payment_confirmed_at || a.created_at).getTime();
                const bTime = new Date(b.payment_confirmed_at || b.created_at).getTime();
                return bTime - aTime;
            }),
        },
    });
}
