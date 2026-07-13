import { ensureNonNegativeFen, subtractFen } from "@/lib/moneyUtils";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

export const COACH_WALLET_REFUND_PROTECTION_DAYS = 7;

const REFUND_PROTECTED_ORDER_TYPES = new Set([
    "subscription",
    "subscription_renew",
    "coach_subscription",
    "coach_subscription_renew",
]);

type WalletTransactionLockRow = {
    amount: number | null;
    alipay_order_id: string | null;
};

type OrderTypeRow = {
    id: string;
    order_type: string | null;
};

type SettlementProtectionRow = {
    alipay_order_id: string;
    eligible_at: string | null;
};

export async function calculateRefundProtectedAmountFen(
    coachId: string,
    now: Date = new Date(),
): Promise<number> {
    const cutoff = new Date(
        now.getTime() - COACH_WALLET_REFUND_PROTECTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: recentIncomeRows, error: txError } = await serviceRoleSupabase
        .from("wallet_transactions")
        .select("amount, alipay_order_id")
        .eq("wallet_id", coachId)
        .eq("type", "income")
        .is("refunded_at", null)
        .not("alipay_order_id", "is", null)
        .gte("created_at", cutoff);

    if (txError) throw txError;

    const rows = (recentIncomeRows ?? []) as WalletTransactionLockRow[];
    const orderIds = Array.from(
        new Set(rows.map((row) => row.alipay_order_id).filter((id): id is string => Boolean(id))),
    );

    if (orderIds.length === 0) return 0;

    const { data: orders, error: orderError } = await serviceRoleSupabase
        .from("alipay_orders")
        .select("id, order_type")
        .in("id", orderIds);

    if (orderError) throw orderError;

    const protectedOrderIds = new Set(
        ((orders ?? []) as OrderTypeRow[])
            .filter((order) => REFUND_PROTECTED_ORDER_TYPES.has(String(order.order_type || "")))
            .map((order) => order.id),
    );

    // Huifu orders are already held in coach_subscription_settlements until
    // eligible_at. When they are finally credited, wallet_transactions gets a
    // fresh created_at; using that timestamp would start a second seven-day
    // protection window and keep an already-eligible payout frozen twice.
    const delayedOrderIds = Array.from(protectedOrderIds);
    const settlementEligibleAtByOrderId = new Map<string, string | null>();

    if (delayedOrderIds.length > 0) {
        const { data: settlements, error: settlementError } = await serviceRoleSupabase
            .from("coach_subscription_settlements")
            .select("alipay_order_id, eligible_at")
            .in("alipay_order_id", delayedOrderIds);

        if (settlementError) throw settlementError;

        for (const settlement of (settlements ?? []) as SettlementProtectionRow[]) {
            settlementEligibleAtByOrderId.set(settlement.alipay_order_id, settlement.eligible_at);
        }
    }

    return rows.reduce((sum, row) => {
        if (!row.alipay_order_id || !protectedOrderIds.has(row.alipay_order_id)) return sum;

        const eligibleAt = settlementEligibleAtByOrderId.get(row.alipay_order_id);
        if (eligibleAt) {
            const eligibleAtMs = new Date(eligibleAt).getTime();
            if (Number.isFinite(eligibleAtMs) && eligibleAtMs <= now.getTime()) {
                return sum;
            }
        }

        return sum + Math.max(0, Math.round(Number(row.amount ?? 0)));
    }, 0);
}

export function getWithdrawableWalletAmounts(params: {
    balanceFen: number;
    storedFrozenFen?: number | null;
    refundProtectedFen?: number | null;
}) {
    const balanceFen = Math.max(0, Math.round(Number(params.balanceFen || 0)));
    const storedFrozenFen = Math.max(0, Math.round(Number(params.storedFrozenFen || 0)));
    const refundProtectedFen = Math.max(0, Math.round(Number(params.refundProtectedFen || 0)));
    const frozenFen = Math.min(balanceFen, storedFrozenFen + refundProtectedFen);
    const withdrawableFen = ensureNonNegativeFen(subtractFen(balanceFen, frozenFen));

    return {
        balanceFen,
        frozenFen,
        refundProtectedFen: Math.min(balanceFen, refundProtectedFen),
        withdrawableFen,
    };
}
