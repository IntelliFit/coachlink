import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { mapLegacySubscriptionToPaymentRecord, mapSubscriptionOrderToPaymentRecord } from "@/lib/coachPaymentRecords";
import { isSubscriptionOrderTableMissingError } from "@/lib/subscriptionOrders";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
  GetPaymentConfirmationHistoryDto,
  GetPaymentConfirmationHistoryResponseDto,
} from "./entity";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        message: "用户未登录",
        data: null,
      },
      { status: 401 },
    );
  }

  const { limit = 50 } = (await req.json()) as GetPaymentConfirmationHistoryDto;

  const { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", session.user.id)
    .single();

  if (coachError || !coach?.id) {
    return NextResponse.json({
      success: false,
      message: coachError?.message || "未找到教练信息",
      data: null,
    });
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const { data: orderRows, error: orderError } = await serviceRoleSupabase
    .from("coach_subscription_orders" as any)
    .select("*")
    .eq("coach_id", coach.id)
    .eq("status", "paid")
    .in("payment_confirmed_by", ["coach", "system"])
    .order("payment_confirmed_at", { ascending: false })
    .limit(safeLimit);

  if (orderError && !isSubscriptionOrderTableMissingError(orderError.message)) {
    return NextResponse.json({
      success: false,
      message: orderError.message,
      data: null,
    });
  }

  const { data: subscriptions, error } = await supabase
    .from("coach_subscriptions")
    .select("*")
    .eq("coach_id", coach.id)
    .not("payment_confirmed_at", "is", null)
    .in("payment_confirmed_by", ["coach", "system"])
    .order("payment_confirmed_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
      data: null,
    });
  }

  return NextResponse.json<ApiData<GetPaymentConfirmationHistoryResponseDto>>({
    success: true,
    message: "获取支付确认历史成功",
    data: {
      subscriptions: [
        ...((orderRows || []).map(mapSubscriptionOrderToPaymentRecord)),
        ...((subscriptions || []).map(mapLegacySubscriptionToPaymentRecord)),
      ]
        .sort((a, b) => {
          const aTime = new Date(a.payment_confirmed_at || a.created_at).getTime();
          const bTime = new Date(b.payment_confirmed_at || b.created_at).getTime();
          return bTime - aTime;
        })
        .slice(0, safeLimit),
    },
  });
}

