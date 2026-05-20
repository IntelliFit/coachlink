import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { sendSystemMessage } from "@/lib/chat";
import { addFen, fenToYuan, formatYuan } from "@/lib/moneyUtils";
import { autoMatchPlanForSubscription } from "@/app/api/plan-lib/auto-match-plan/service";
import { finalizeSubscriptionOrder } from "@/lib/subscriptionOrders";
import {
    type SplitActual,
    transferByBalancePayment,
    generateReqSeqId,
    formatHuifuReqDate,
    parseAcctSplitBunch,
    queryBalancePayment,
} from "@/lib/huifuMiniProgramPay";

type PaymentProvider = "alipay" | "wechat";

type SettlementStatus =
    | "pending"
    | "processing"
    | "split_success"
    | "split_failed"
    | "wallet_credited"
    | "refunded";

interface SettlementRow {
    id: string;
    alipay_order_id: string;
    status: SettlementStatus;
    attempts: number | null;
    acct_split_bunch?: unknown;
    eligible_at?: string | null;
    req_date?: string | null;
    req_seq_id?: string | null;
    huifu_hf_seq_id?: string | null;
    trans_stat?: string | null;
}

export interface BalancePaymentResult {
    status: SettlementStatus | "skipped";
    shouldCreditWallet: boolean;
    splitInfo?: SplitActual[];
    message?: string;
}

function getPaymentMethod(provider: PaymentProvider) {
    return provider === "wechat" ? "platform_wechat" : "platform_alipay";
}

function getPaymentLabel(provider: PaymentProvider) {
    return provider === "wechat" ? "微信支付" : "平台支付";
}

function settlementTable() {
    return (serviceRoleSupabase as any).from("coach_subscription_settlements");
}

function platformRevenueTable() {
    return (serviceRoleSupabase as any).from("platform_revenue");
}

export function isCoachSubscriptionOrderType(orderType: unknown) {
    return (
        orderType === "coach_subscription" ||
        orderType === "coach_subscription_renew"
    );
}

export function isCoachContentPurchaseOrderType(orderType: unknown) {
    return orderType === "content_purchase";
}

export function isCoachRevenueOrderType(orderType: unknown) {
    return isCoachSubscriptionOrderType(orderType) || isCoachContentPurchaseOrderType(orderType);
}

function isLegacySubscriptionOrderType(orderType: unknown) {
    return orderType === "subscription" || orderType === "subscription_renew";
}

function asObject(value: unknown): Record<string, any> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, any>)
        : {};
}

function orderIdOf(order: { id?: unknown }) {
    return String(order.id || "").trim();
}

function amountFenOf(order: {
    total_amount?: number | string | null;
    amount?: number | string | null;
    order_data?: unknown;
}) {
    const orderData = asObject(order.order_data);
    return Math.round(Number(order.total_amount ?? order.amount ?? orderData.amount ?? 0));
}

function splitAmountsFen(totalFen: number) {
    const platformFee = Math.floor((totalFen * 20) / 100);
    return {
        coachAmount: totalFen - platformFee,
        platformFee,
    };
}

function getSettlementDelayDays(order: Record<string, any>) {
    const orderData = asObject(order.order_data);
    if (orderData.is_test_payment && process.env.NODE_ENV !== "production") {
        return 0;
    }

    const configured = Number(process.env.COACH_SUBSCRIPTION_SETTLEMENT_DELAY_DAYS ?? "7");
    if (!Number.isFinite(configured)) return 7;
    return Math.max(0, configured);
}

function calculateEligibleAt(order: Record<string, any>) {
    const base = order.paid_at || order.updated_at || order.created_at || new Date().toISOString();
    const date = new Date(base);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();

    date.setDate(date.getDate() + getSettlementDelayDays(order));
    return date.toISOString();
}

function isFutureIso(iso: string | null | undefined, now: Date) {
    if (!iso) return false;
    const date = new Date(iso);
    return !Number.isNaN(date.getTime()) && date.getTime() > now.getTime();
}

export function requiresHuifuSettlement(order: Record<string, any>) {
    const orderData = asObject(order.order_data);
    const provider = String(order.payment_provider || "").trim();
    const hasCoach = Boolean(String(orderData.coachId || "").trim());
    if (!hasCoach) return false;
    if (isCoachContentPurchaseOrderType(order.order_type)) {
        return provider === "wechat" || provider === "huifu_alipay" || Boolean(orderData.huifu_req_date);
    }
    if (isCoachSubscriptionOrderType(order.order_type)) return true;
    if (!isLegacySubscriptionOrderType(order.order_type)) return false;
    return provider === "wechat" || provider === "huifu_alipay" || Boolean(orderData.huifu_req_date);
}

function toJsonObject(value: unknown) {
    if (!value) return null;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
    return value;
}

function parseSavedSplit(value: unknown): SplitActual[] {
    const parsed = toJsonObject(value);
    return parsed ? parseAcctSplitBunch(parsed as Record<string, unknown>) : [];
}

async function walletTransactionExists(orderId: string) {
    const { data } = await serviceRoleSupabase
        .from("wallet_transactions")
        .select("id")
        .eq("alipay_order_id", orderId)
        .limit(1);
    return Boolean(data && data.length > 0);
}

async function fetchSettlement(orderId: string): Promise<SettlementRow | null> {
    const { data, error } = await settlementTable()
        .select("*")
        .eq("alipay_order_id", orderId)
        .maybeSingle();
    if (error) throw error;
    return (data as SettlementRow | null) ?? null;
}

async function ensureSettlement(
    order: Record<string, any>,
    coachId: string,
    totalFen: number,
) {
    const orderId = orderIdOf(order);
    const orderData = asObject(order.order_data);
    const { coachAmount, platformFee } = splitAmountsFen(totalFen);
    const payload = {
        alipay_order_id: orderId,
        subscription_id: orderData.subscriptionId || null,
        coach_id: coachId,
        student_id: order.user_id || null,
        order_type: String(order.order_type || "coach_subscription"),
        total_amount: totalFen,
        coach_amount: coachAmount,
        platform_fee: platformFee,
        eligible_at: calculateEligibleAt(order),
    };

    const { error: insertError } = await settlementTable().insert(payload);
    if (insertError && insertError.code !== "23505") {
        throw insertError;
    }

    const settlement = await fetchSettlement(orderId);
    if (!settlement) {
        throw new Error(`Settlement row was not created for order ${orderId}`);
    }
    if (!settlement.eligible_at) {
        await settlementTable()
            .update({
                eligible_at: payload.eligible_at,
                updated_at: new Date().toISOString(),
            })
            .eq("id", settlement.id);
        settlement.eligible_at = payload.eligible_at;
    }
    return settlement;
}

async function markSettlementSplitFailed(settlementId: string, message: string) {
    await settlementTable()
        .update({
            status: "split_failed",
            error_message: message.slice(0, 1000),
            updated_at: new Date().toISOString(),
        })
        .eq("id", settlementId);
}

async function markSettlementSplitSuccess(
    settlementId: string,
    result: Record<string, any>,
    acctSplitBunch: unknown,
) {
    await settlementTable()
        .update({
            status: "split_success",
            huifu_hf_seq_id: result.hf_seq_id || null,
            trans_stat: result.trans_stat || null,
            acct_split_bunch: toJsonObject(acctSplitBunch),
            error_message: null,
            split_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", settlementId);
}

async function markSettlementStillProcessing(
    settlementId: string,
    result: Record<string, any>,
    acctSplitBunch: unknown,
) {
    await settlementTable()
        .update({
            status: "processing",
            huifu_hf_seq_id: result.hf_seq_id || null,
            trans_stat: result.trans_stat || null,
            acct_split_bunch: toJsonObject(acctSplitBunch),
            error_message: result.resp_desc || null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", settlementId);
}

/**
 * Split coach-subscription revenue from the platform Huifu cash account.
 *
 * This function is intentionally stricter than local wallet credit:
 * - wallet_transactions is checked only as a local "already credited" guard;
 * - coach_subscription_settlements is the remote-call idempotency guard;
 * - no wallet credit is allowed unless Huifu split reaches split_success.
 */
export async function executeBalancePayment(
    order: Record<string, any>,
    options: { force?: boolean; now?: Date } = {},
): Promise<BalancePaymentResult> {
    const orderId = orderIdOf(order);

    try {
        if (!orderId) {
            return { status: "skipped", shouldCreditWallet: false, message: "Missing order id" };
        }

        if (await walletTransactionExists(orderId)) {
            await markSettlementWalletCredited(orderId);
            return { status: "wallet_credited", shouldCreditWallet: false };
        }

        const orderData = asObject(order.order_data);
        const coachId = String(orderData.coachId || "").trim();
        const totalFen = amountFenOf(order);
        if (!coachId || totalFen <= 0) {
            return { status: "skipped", shouldCreditWallet: false, message: "Missing coach id or amount" };
        }

        const { data: coach } = await serviceRoleSupabase
            .from("coaches")
            .select("huifu_id, huifu_open_status, huifu_card_token")
            .eq("id", coachId)
            .maybeSingle();

        const coachHuifuId = String(coach?.huifu_id || "").trim();
        const platformHuifuId = String(process.env.HUIFU_CUSTOMER_ID || "").trim();
        if (coach?.huifu_open_status !== "opened" || !coach?.huifu_card_token) {
            const message = "Coach Huifu account is not fully opened";
            console.error("[executeBalancePayment]", message, {
                coachId,
                coachHuifuId,
                huifuOpenStatus: coach?.huifu_open_status,
                hasCardToken: Boolean(coach?.huifu_card_token),
                orderId,
            });
            return { status: "skipped", shouldCreditWallet: false, message };
        }

        if (!coachHuifuId || !platformHuifuId) {
            const message = "Missing coach or platform Huifu id";
            console.error("[executeBalancePayment]", message, { coachHuifuId, platformHuifuId, orderId });
            return { status: "skipped", shouldCreditWallet: false, message };
        }

        const settlement = await ensureSettlement(order, coachId, totalFen);

        if (settlement.status === "wallet_credited") {
            return { status: "wallet_credited", shouldCreditWallet: false };
        }

        if (settlement.status === "refunded") {
            return { status: "refunded", shouldCreditWallet: false, message: "Settlement was refunded" };
        }

        if (settlement.status === "split_success") {
            const splitInfo = parseSavedSplit(settlement.acct_split_bunch);
            return {
                status: "split_success",
                shouldCreditWallet: splitInfo.length > 0,
                splitInfo,
                message: splitInfo.length > 0 ? undefined : "Saved split detail is empty",
            };
        }

        if (settlement.status === "processing") {
            return {
                status: "processing",
                shouldCreditWallet: false,
                message: "Settlement is already processing",
            };
        }

        const now = options.now || new Date();
        if (!options.force && isFutureIso(settlement.eligible_at, now)) {
            return {
                status: "pending",
                shouldCreditWallet: false,
                message: `Settlement is not eligible until ${settlement.eligible_at}`,
            };
        }

        const reqDate = formatHuifuReqDate();
        const reqSeqId = generateReqSeqId();
        const nowIso = now.toISOString();

        const { data: claimed, error: claimError } = await settlementTable()
            .update({
                status: "processing",
                req_date: reqDate,
                req_seq_id: reqSeqId,
                attempts: Number(settlement.attempts || 0) + 1,
                last_attempt_at: nowIso,
                error_message: null,
                updated_at: nowIso,
            })
            .eq("id", settlement.id)
            .in("status", ["pending", "split_failed"])
            .select("*")
            .maybeSingle();

        if (claimError) throw claimError;
        if (!claimed) {
            return {
                status: "processing",
                shouldCreditWallet: false,
                message: "Settlement was claimed by another callback",
            };
        }

        const { coachAmount } = splitAmountsFen(totalFen);
        const result = await transferByBalancePayment({
            reqDate,
            reqSeqId,
            transAmtYuan: formatYuan(fenToYuan(coachAmount)),
            receivers: [
                { huifuId: coachHuifuId, divAmt: formatYuan(fenToYuan(coachAmount)) },
            ],
            remark: `coach_subscription:${orderId}`,
        });

        const splitInfo = result.acct_split_bunch
            ? parseAcctSplitBunch(result.acct_split_bunch)
            : [];
        const isSuccess =
            result.trans_stat === "S" ||
            (result.resp_code === "00000000" && splitInfo.length > 0);
        const isProcessing =
            result.trans_stat === "P" ||
            result.resp_code === "00000100";

        if (isSuccess && splitInfo.length > 0) {
            await markSettlementSplitSuccess(settlement.id, result, result.acct_split_bunch);
            return { status: "split_success", shouldCreditWallet: true, splitInfo };
        }

        if (isProcessing) {
            await markSettlementStillProcessing(settlement.id, result, result.acct_split_bunch);
            return {
                status: "processing",
                shouldCreditWallet: false,
                message: result.resp_desc || "Huifu split is processing",
            };
        }

        const message = result.resp_desc || "Huifu split failed or returned no split detail";
        await markSettlementSplitFailed(settlement.id, message);
        return { status: "split_failed", shouldCreditWallet: false, message };
    } catch (error: any) {
        console.error("[executeBalancePayment] failed:", error);
        const message = error?.message || "Huifu split failed";
        const settlement = orderId ? await fetchSettlement(orderId).catch(() => null) : null;
        if (settlement?.id) {
            const marker =
                settlement.status === "processing"
                    ? markSettlementStillProcessing(settlement.id, { resp_desc: message }, settlement.acct_split_bunch)
                    : markSettlementSplitFailed(settlement.id, message);
            await marker.catch((markError) => {
                console.error("[executeBalancePayment] mark failed:", markError);
            });
        }
        return {
            status: settlement?.status === "processing" ? "processing" : "split_failed",
            shouldCreditWallet: false,
            message,
        };
    }
}

export async function reconcileBalancePaymentSettlement(
    settlement: SettlementRow,
    _order: Record<string, any>,
): Promise<BalancePaymentResult> {
    if (!settlement.req_date || !settlement.req_seq_id) {
        return {
            status: settlement.status,
            shouldCreditWallet: false,
            message: "Missing Huifu request identity",
        };
    }

    const result = await queryBalancePayment({
        orgReqDate: settlement.req_date,
        orgReqSeqId: settlement.req_seq_id,
    });
    const splitInfo = result.acct_split_bunch
        ? parseAcctSplitBunch(result.acct_split_bunch)
        : parseSavedSplit(settlement.acct_split_bunch);

    const isSuccess =
        result.trans_stat === "S" ||
        (result.resp_code === "00000000" && splitInfo.length > 0);
    const isProcessing =
        result.trans_stat === "P" ||
        result.resp_code === "00000100";

    if (isSuccess && splitInfo.length > 0) {
        await markSettlementSplitSuccess(
            settlement.id,
            result,
            result.acct_split_bunch || settlement.acct_split_bunch,
        );
        return { status: "split_success", shouldCreditWallet: true, splitInfo };
    }

    if (isProcessing) {
        await markSettlementStillProcessing(
            settlement.id,
            result,
            result.acct_split_bunch || settlement.acct_split_bunch,
        );
        return {
            status: "processing",
            shouldCreditWallet: false,
            message: result.resp_desc || "Huifu split is processing",
        };
    }

    const message = result.resp_desc || "Huifu split failed";
    await markSettlementSplitFailed(settlement.id, message);
    return { status: "split_failed", shouldCreditWallet: false, message };
}

export async function markSettlementRefunded(
    orderId: string,
    values: Record<string, unknown> = {},
): Promise<void> {
    const id = String(orderId || "").trim();
    if (!id) return;

    await settlementTable()
        .update({
            ...values,
            status: "refunded",
            updated_at: new Date().toISOString(),
        })
        .eq("alipay_order_id", id);
}

/**
 * Mark a settlement as locally credited after wallet_transactions and
 * platform_revenue are written successfully.
 */
export async function markSettlementWalletCredited(orderId: string): Promise<void> {
    const id = String(orderId || "").trim();
    if (!id) return;

    await settlementTable()
        .update({
            status: "wallet_credited",
            wallet_credited_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("alipay_order_id", id)
        .in("status", ["split_success", "wallet_credited"]);
}

export async function fulfillSubscriptionAndMaybeCreditWallet(
    order: Record<string, any>,
    userId: string,
    provider: PaymentProvider = "alipay",
): Promise<BalancePaymentResult | null> {
    const orderType = order.order_type;
    if (!isCoachSubscriptionOrderType(orderType) && !isLegacySubscriptionOrderType(orderType)) {
        return null;
    }

    await fulfillSubscriptionOnPaid(order, String(order.id || ""), userId, provider);

    if (requiresHuifuSettlement(order)) {
        const splitResult = await executeBalancePayment(order);
        if (splitResult.shouldCreditWallet) {
            const walletUpdated = await updateTransactionAndWallet(order, splitResult.splitInfo);
            if (walletUpdated) {
                await markSettlementWalletCredited(String(order.id || ""));
            }
        }
        return splitResult;
    }

    await updateTransactionAndWallet(order);
    return null;
}

/**
 * Local coach wallet credit and revenue record.
 *
 * For coach subscription orders, splitInfo is mandatory. Without it, the
 * function refuses to credit the coach wallet to avoid booking 100% revenue
 * when the Huifu split did not complete.
 */
export async function updateTransactionAndWallet(
    order: {
        id: string;
        order_type?: string | null;
        order_data?: unknown;
        total_amount?: number | string | null;
        amount?: number | string | null;
        subject?: string | null;
    },
    splitInfo?: SplitActual[],
): Promise<boolean> {
    try {
        const orderId = orderIdOf(order);
        const orderData = asObject(order.order_data);
        const coachId = String(orderData.coachId || "").trim();
        const amountFen = amountFenOf(order);
        if (!orderId || !coachId || amountFen <= 0) return false;

        if (requiresHuifuSettlement(order as Record<string, any>) && (!splitInfo || splitInfo.length === 0)) {
            console.error("[updateTransactionAndWallet] refusing coach wallet credit without splitInfo", {
                orderId,
                orderType: order.order_type,
            });
            return false;
        }

        const platformHuifuId = String(process.env.HUIFU_CUSTOMER_ID || "").trim();
        const coachSplit = splitInfo?.find((item) => item.huifuId !== platformHuifuId);
        const platformSplit = splitInfo?.find((item) => item.huifuId === platformHuifuId);
        const coachAmount = coachSplit?.divAmtFen ?? amountFen;
        const platformFee = platformSplit?.divAmtFen ?? Math.max(0, amountFen - coachAmount);

        if (await walletTransactionExists(orderId)) return true;

        await serviceRoleSupabase.from("coach_wallets").upsert(
            {
                coach_id: coachId,
                balance: 0,
                total_income: 0,
                frozen_amount: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "coach_id", ignoreDuplicates: true },
        );

        const description =
            String(orderData.subject || order.subject || "").trim() ||
            `Payment order ${orderId}`;
        const { error: insertErr } = await serviceRoleSupabase.from("wallet_transactions").insert({
            wallet_id: coachId,
            amount: coachAmount,
            platform_fee: platformFee,
            type: "income",
            alipay_order_id: orderId,
            description,
            created_at: new Date().toISOString(),
        });

        if (insertErr?.code === "23505") return true;
        if (insertErr) throw insertErr;

        const { data: wallet } = await serviceRoleSupabase
            .from("coach_wallets")
            .select("balance, total_income")
            .eq("coach_id", coachId)
            .single();

        if (wallet) {
            await serviceRoleSupabase
                .from("coach_wallets")
                .update({
                    balance: addFen(Number(wallet.balance ?? 0), coachAmount),
                    total_income: addFen(Number(wallet.total_income ?? 0), coachAmount),
                    updated_at: new Date().toISOString(),
                })
                .eq("coach_id", coachId);
        }

        if (platformFee > 0) {
            const { error: revenueError } = await platformRevenueTable().upsert(
                {
                    source_order_id: orderId,
                    order_type: String(order.order_type || "coach_subscription"),
                    amount: platformFee,
                    coach_id: coachId,
                    created_at: new Date().toISOString(),
                },
                { onConflict: "source_order_id" },
            );
            if (revenueError) throw revenueError;
        }

        return true;
    } catch (error) {
        console.error("[fulfillPaidOrder] updateTransactionAndWallet:", error);
        return false;
    }
}

/**
 * Confirm a subscription/renewal and notify the coach. Idempotency is based on
 * coach_subscriptions.last_payment_order_id.
 */
export async function fulfillSubscriptionOnPaid(
    order: {
        id: string;
        order_type?: string | null;
        order_data?: unknown;
        user_id?: string | null;
    },
    orderId: string,
    userId: string,
    provider: PaymentProvider = "alipay",
): Promise<void> {
    const orderData = asObject(order.order_data);
    const subscriptionOrderId = orderData.subscriptionOrderId as string | undefined;
    const subscriptionId = orderData.subscriptionId as string | undefined;
    const coachId = orderData.coachId as string | undefined;

    if (subscriptionOrderId) {
        await finalizeSubscriptionOrder({
            orderId: subscriptionOrderId,
            confirmedBy: "system",
            alipayOrderId: order.id,
            expectedStudentId: userId,
        });
        return;
    }

    if (!subscriptionId) return;

    const { data: sub } = await serviceRoleSupabase
        .from("coach_subscriptions")
        .select("id, student_id, coach_id, status, start_date, end_date, subscribed_weeks, last_payment_order_id")
        .eq("id", subscriptionId)
        .single();

    if (!sub || sub.student_id !== userId) return;
    if (coachId && sub.coach_id !== coachId) return;
    if (sub.last_payment_order_id === order.id) return;

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
        payment_method: getPaymentMethod(provider),
        payment_confirmed_by: "system",
        payment_confirmed_at: nowIso,
        coach_seen_at: null,
        last_payment_order_id: order.id,
        order_id: order.id,
    };

    if (order.order_type === "subscription" || order.order_type === "coach_subscription") {
        update.status = "active";
    }

    if (order.order_type === "subscription_renew" || order.order_type === "coach_subscription_renew") {
        const weeks = Number(orderData.renewAdditionalWeeks ?? 0);
        if (weeks > 0) {
            update.subscribed_weeks = Number(sub.subscribed_weeks || 0) + weeks;
            if (sub.end_date) {
                const base = new Date(sub.end_date);
                const now = new Date();
                const effectiveBase = base.getTime() < now.getTime() ? now : base;
                effectiveBase.setDate(effectiveBase.getDate() + weeks * 7);
                update.end_date = effectiveBase.toISOString();
            }
        }
    }

    await serviceRoleSupabase
        .from("coach_subscriptions")
        .update(update)
        .eq("id", subscriptionId);

    try {
        const { data: coach } = await serviceRoleSupabase
            .from("coaches")
            .select("user_id")
            .eq("id", sub.coach_id)
            .single();

        if (!coach?.user_id) return;

        await sendSystemMessage(coach.user_id, {
            content: `新的学员订阅已通过【${getPaymentLabel(provider)}】完成，系统已自动确认。请前往 [我的学员](/dashboard/students) 查看。`,
        });

        if (order.order_type === "subscription" || order.order_type === "coach_subscription") {
            const matchRes = await autoMatchPlanForSubscription(
                subscriptionId,
                coach.user_id,
                sub.coach_id,
            );
            const matchMsg = matchRes.success
                ? "系统已自动匹配训练计划，学员将在约 5 分钟后看到计划。"
                : `自动匹配失败（${matchRes.reason || "未知原因"}），请前往 [我的学员](/dashboard/students) 手动创建计划。`;
            await sendSystemMessage(coach.user_id, {
                content: `该学员订阅的计划分配结果：${matchMsg}`,
            });
        }
    } catch (error) {
        console.error("[fulfillPaidOrder] send coach system message:", error);
    }
}
