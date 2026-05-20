import { serviceRoleSupabase } from "@/lib/supabaseClient";
import {
  executeBalancePayment,
  markSettlementWalletCredited,
  requiresHuifuSettlement,
  updateTransactionAndWallet,
} from "@/app/api/payment/alipay/fulfillPaidOrder";

/**
 * Idempotent fulfillment for coach-owned single-content purchases.
 *
 * Content access is unlocked as soon as the source payment is paid. Coach
 * wallet income follows the same Huifu delayed-settlement rule as coach
 * subscriptions: local wallet credit is allowed only after Huifu balance
 * payment succeeds.
 */
export async function fulfillContentPurchasePaid(args: {
  orderId: string;
  userId: string;
  contentId: string;
}) {
  const { orderId, userId, contentId } = args;
  const nowIso = new Date().toISOString();

  await serviceRoleSupabase
    .from("content_purchases" as any)
    .upsert(
      {
        content_id: contentId,
        user_id: userId,
        order_id: orderId,
        status: "paid",
        paid_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id,content_id" },
    );

  const { data: order } = await serviceRoleSupabase
    .from("alipay_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || (order as any).status !== "paid" || (order as any).order_type !== "content_purchase") {
    return;
  }

  const { data: content } = await serviceRoleSupabase
    .from("coach_contents")
    .select("id,title,coach_id")
    .eq("id", contentId)
    .maybeSingle();
  if (!content) return;

  const coachId = String((content as any).coach_id || "");
  const amountCents = Number((order as any).total_amount ?? 0);
  if (!coachId || !amountCents || amountCents <= 0) return;

  const enrichedOrder = {
    ...(order as any),
    order_data: {
      ...(((order as any).order_data || {}) as Record<string, any>),
      coachId,
      contentId,
      contentTitle: String((content as any).title || "").trim(),
    },
  };
  await serviceRoleSupabase
    .from("alipay_orders")
    .update({ order_data: enrichedOrder.order_data as any })
    .eq("id", orderId);

  if (requiresHuifuSettlement(enrichedOrder)) {
    const splitResult = await executeBalancePayment(enrichedOrder);
    if (splitResult.shouldCreditWallet) {
      const walletUpdated = await updateTransactionAndWallet(enrichedOrder, splitResult.splitInfo);
      if (walletUpdated) {
        await markSettlementWalletCredited(orderId);
      }
    }
    return;
  }

  await updateTransactionAndWallet(enrichedOrder);
}
