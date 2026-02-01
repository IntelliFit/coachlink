import { serviceRoleSupabase } from "@/lib/supabaseClient";

/**
 * 单篇购买支付成功后的落库与教练入账（幂等）。
 *
 * 依赖数据库函数 `public.credit_coach_wallet`（见 supabase/migrations/20260130_content_purchase_wallet_credit.sql）。
 * 如果函数不存在，会降级为 best-effort（不保证并发下严格一致）。
 */
export async function fulfillContentPurchasePaid(args: {
  orderId: string;
  userId: string;
  contentId: string;
}) {
  const { orderId, userId, contentId } = args;

  const nowIso = new Date().toISOString();

  // 1) Mark purchase paid (idempotent by user_id,content_id unique index)
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

  // 2) Load order amount + content coach
  const { data: order } = await serviceRoleSupabase
    .from("alipay_orders")
    .select("id,total_amount,status,order_type")
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

  const description = `文章单篇购买收入：${String((content as any).title || "").trim()}`.slice(0, 200);

  // 3) Atomic credit via SQL function (preferred)
  try {
    await serviceRoleSupabase.rpc("credit_coach_wallet" as any, {
      p_coach_id: coachId,
      p_amount: amountCents,
      p_related_order_id: orderId,
      p_description: description,
    });
    return;
  } catch (e) {
    console.error("[content_purchase] credit_coach_wallet rpc failed, fallback:", e);
  }

  // 4) Fallback (best-effort, not fully atomic)
  const { data: exists } = await serviceRoleSupabase
    .from("wallet_transactions")
    .select("id")
    .eq("related_order_id", orderId)
    .eq("type", "income")
    .maybeSingle();
  if (exists) return;

  await serviceRoleSupabase
    .from("coach_wallets")
    .upsert(
      { coach_id: coachId, balance: 0, total_income: 0, frozen_amount: 0, updated_at: nowIso },
      { onConflict: "coach_id" },
    );

  const { data: wallet } = await serviceRoleSupabase
    .from("coach_wallets")
    .select("balance,total_income")
    .eq("coach_id", coachId)
    .maybeSingle();

  const newBalance = Number((wallet as any)?.balance ?? 0) + amountCents;
  const newTotalIncome = Number((wallet as any)?.total_income ?? 0) + amountCents;

  await serviceRoleSupabase
    .from("coach_wallets")
    .update({ balance: newBalance, total_income: newTotalIncome, updated_at: nowIso })
    .eq("coach_id", coachId);

  await serviceRoleSupabase
    .from("wallet_transactions")
    .insert({
      wallet_id: coachId,
      amount: amountCents,
      type: "income",
      related_order_id: orderId,
      description,
    });
}


