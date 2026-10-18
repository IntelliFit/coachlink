import { autoMatchPlanForSubscription } from "@/app/api/plan-lib/auto-match-plan/service";
import { onRenewalPaid } from "@/lib/coachingAutomation";
import { sendSystemMessage } from "@/lib/chat";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { CoachSubscriptionRow } from "@/types";
import type { Json } from "@/types/database.types";
import type { CoachSubscriptionOrderRow } from "@/types/subscriptionOrders";
import { refreshSubscriptionEntitlementSnapshot } from "@/lib/subscriptionEntitlementSnapshot";
import { applyPaidPackageRenewal, activateQueuedPackageIfReady } from '@/lib/subscriptionPackageQueue';

const ORDER_TABLE = "coach_subscription_orders" as any;
const MISSING_ORDER_TABLE_HINT =
    "订阅订单表尚未迁移，请先执行 supabase/migrations/20260422_subscription_orders.sql";

type PaymentConfirmedBy = "coach" | "system";

interface UpsertSubscriptionOrderInput {
    studentId: string;
    coachId: string;
    orderType: "subscribe" | "renew";
    subscriptionId?: string | null;
    tier: number;
    amountFen: number;
    productId?: string | null;
    productName?: string | null;
    productTier?: string | null;
    purchasedWeeks?: number | null;
    subscribeData?: Json | null;
    packageSwitchPolicy?: 'after_current';
}

interface SubmitSubscriptionOrderInput {
    orderId: string;
    studentId: string;
    paymentMethod: string;
    note?: string | null;
    paymentData?: Json | null;
}

interface FinalizeSubscriptionOrderInput {
    orderId: string;
    confirmedBy: PaymentConfirmedBy;
    alipayOrderId?: string | null;
    expectedStudentId?: string | null;
}

interface FinalizeSubscriptionOrderResult {
    order: CoachSubscriptionOrderRow;
    subscription: CoachSubscriptionRow;
}

function asOrderRow(value: any): CoachSubscriptionOrderRow {
    return value as CoachSubscriptionOrderRow;
}

export function isSubscriptionOrderTableMissingError(error: unknown): boolean {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === "string"
                ? error
                : "";

    return (
        message.includes(MISSING_ORDER_TABLE_HINT) ||
        message.includes("coach_subscription_orders") &&
        (message.includes("does not exist") ||
            message.includes("42P01") ||
            message.includes("relation"))
    );
}

export function getSubscriptionOrderMissingTableMessage() {
    return MISSING_ORDER_TABLE_HINT;
}

function asObject(value: Json | null | undefined): Record<string, any> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, any>;
}

const APPLIED_ORDER_IDS_KEY = "applied_subscription_order_ids";
const APPLIED_ORDER_IDS_LIMIT = 50;
const WEEKS_UPDATE_ATTEMPTS = 3;

/** Whether this order's weeks were already added to the subscription (payment callbacks can race). */
function hasAppliedOrder(subscription: { payment_data?: Json | null } | null | undefined, orderId: string) {
    const data = asObject(subscription?.payment_data);
    const applied = Array.isArray(data[APPLIED_ORDER_IDS_KEY]) ? data[APPLIED_ORDER_IDS_KEY] : [];
    return applied.includes(orderId);
}

function withAppliedOrder(paymentData: Record<string, any>, previous: Json | null | undefined, orderId: string) {
    const applied = asObject(previous)[APPLIED_ORDER_IDS_KEY];
    const list = Array.isArray(applied) ? applied.filter((id: unknown) => id !== orderId) : [];
    return { ...paymentData, [APPLIED_ORDER_IDS_KEY]: [...list, orderId].slice(-APPLIED_ORDER_IDS_LIMIT) };
}

async function fetchSubscriptionById(subscriptionId: string): Promise<CoachSubscriptionRow> {
    const { data, error } = await serviceRoleSupabase
        .from("coach_subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .single();
    if (error || !data) throw new Error(error?.message || "订阅不存在");
    return data as CoachSubscriptionRow;
}

/**
 * Adds an order's weeks exactly once. The write is conditional on the weeks
 * just read, so concurrent callbacks for the same or another order re-read
 * and retry instead of overwriting each other.
 */
async function addOrderWeeksToSubscription(
    subscriptionId: string,
    order: CoachSubscriptionOrderRow,
    buildUpdate: (subscription: CoachSubscriptionRow) => Record<string, unknown>,
): Promise<{ subscription: CoachSubscriptionRow; applied: boolean }> {
    for (let attempt = 0; attempt < WEEKS_UPDATE_ATTEMPTS; attempt += 1) {
        const subscription = await fetchSubscriptionById(subscriptionId);
        if (hasAppliedOrder(subscription, order.id)) return { subscription, applied: false };
        const currentWeeks = Number(subscription.subscribed_weeks || 0);
        const update = buildUpdate(subscription);
        update.payment_data = withAppliedOrder(asObject(update.payment_data as Json), subscription.payment_data as Json, order.id) as Json;
        let query = serviceRoleSupabase.from("coach_subscriptions").update(update).eq("id", subscriptionId);
        query = subscription.subscribed_weeks === null || subscription.subscribed_weeks === undefined
            ? query.is("subscribed_weeks", null)
            : query.eq("subscribed_weeks", currentWeeks);
        const { data, error } = await query.select();
        if (error) throw new Error(error.message || "更新订阅额度失败");
        if (Array.isArray(data) && data.length > 0) return { subscription: data[0] as CoachSubscriptionRow, applied: true };
    }
    throw new Error("订阅额度正在被同时更新，请稍后重试");
}

async function fetchOrderById(orderId: string): Promise<CoachSubscriptionOrderRow | null> {
    const { data, error } = await serviceRoleSupabase
        .from(ORDER_TABLE)
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

    if (error) {
        if (isSubscriptionOrderTableMissingError(error.message)) {
            throw new Error(MISSING_ORDER_TABLE_HINT);
        }
        throw new Error(error.message);
    }

    return data ? asOrderRow(data) : null;
}

async function fetchCoachOwnerUserId(coachId: string): Promise<string | null> {
    const { data, error } = await serviceRoleSupabase
        .from("coaches")
        .select("user_id")
        .eq("id", coachId)
        .single();

    if (error || !data?.user_id) {
        return null;
    }

    return data.user_id;
}

async function fetchLatestSubscriptionForPair(
    studentId: string,
    coachId: string,
): Promise<CoachSubscriptionRow | null> {
    const { data, error } = await serviceRoleSupabase
        .from("coach_subscriptions")
        .select("*")
        .eq("student_id", studentId)
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        throw new Error(error.message);
    }

    return ((data || [])[0] as CoachSubscriptionRow | undefined) || null;
}

async function upsertSubscriptionRow(
    studentId: string,
    coachId: string,
    payload: Record<string, unknown>,
): Promise<CoachSubscriptionRow> {
    const existing = await fetchLatestSubscriptionForPair(studentId, coachId);

    if (existing) {
        const { data, error } = await serviceRoleSupabase
            .from("coach_subscriptions")
            .update(payload)
            .eq("id", existing.id)
            .select()
            .single();

        if (error || !data) {
            throw new Error(error?.message || "更新订阅失败");
        }

        return data as CoachSubscriptionRow;
    }

    const { data, error } = await serviceRoleSupabase
        .from("coach_subscriptions")
        .insert({
            student_id: studentId,
            coach_id: coachId,
            ...payload,
        } as any)
        .select()
        .single();

    if (error || !data) {
        throw new Error(error?.message || "创建订阅失败");
    }

    return data as CoachSubscriptionRow;
}

async function notifyCoachPendingConfirmation(order: CoachSubscriptionOrderRow) {
    const coachUserId = await fetchCoachOwnerUserId(order.coach_id);
    if (!coachUserId) return;

    await sendSystemMessage(coachUserId, {
        content:
            "新的学员订阅来了！请前往 [我的学员](/dashboard/students) 查看，并在右上角【待支付确认】中确认收款。",
    });
}

async function notifyCoachAfterSubscribePaid(
    subscriptionId: string,
    coachId: string,
    confirmedBy: PaymentConfirmedBy,
) {
    const coachUserId = await fetchCoachOwnerUserId(coachId);
    if (!coachUserId) return;

    if (confirmedBy === "system") {
        await sendSystemMessage(coachUserId, {
            content:
                "新的学员订阅通过【平台支付】完成，系统已自动确认。请前往 [我的学员](/dashboard/students) 查看。",
        });
    }

    const matchRes = await autoMatchPlanForSubscription(
        subscriptionId,
        coachUserId,
        coachId,
    );
    const matchMsg = matchRes.success
        ? "系统已自动匹配并发放训练计划，学员现在可以查看计划。"
        : `自动匹配失败（${matchRes.reason || "未知原因"}），请前往 [我的学员](/dashboard/students) 手动创建计划。`;

    await sendSystemMessage(coachUserId, {
        content: `该学员订阅的计划分配结果：${matchMsg}`,
    });
}

function buildSubscriptionPaymentData(
    order: CoachSubscriptionOrderRow,
    alipayOrderId?: string | null,
): Json {
    const nextPaymentData = asObject(order.payment_data);
    return {
        ...nextPaymentData,
        latest_subscription_order_id: order.id,
        latest_payment_method: order.payment_method,
        latest_alipay_order_id: alipayOrderId || nextPaymentData.latest_alipay_order_id || null,
    } as Json;
}

async function activateSubscribeOrder(
    order: CoachSubscriptionOrderRow,
    confirmedBy: PaymentConfirmedBy,
    alipayOrderId?: string | null,
): Promise<CoachSubscriptionRow> {
    const paymentConfirmedAt = new Date().toISOString();
    const subscriptionPayload: Record<string, unknown> = {
        tier: order.tier,
        monthly_price: Number(order.amount_fen || 0),
        status: "active",
        subscribe_data: order.subscribe_data,
        start_date: null,
        product_id: order.product_id,
        product_name: order.product_name,
        product_tier: order.product_tier,
        subscribed_weeks: order.purchased_weeks,
        payment_method: order.payment_method,
        payment_confirmed_by: confirmedBy,
        payment_confirmed_at: paymentConfirmedAt,
        coach_seen_at: confirmedBy === "system" ? null : paymentConfirmedAt,
        payment_data: buildSubscriptionPaymentData(order, alipayOrderId),
        order_id: alipayOrderId || null,
        last_payment_order_id: alipayOrderId || null,
    };

    const existing = await fetchLatestSubscriptionForPair(order.student_id, order.coach_id);
    if (existing && hasAppliedOrder(existing, order.id)) return existing;
    if (existing) {
        const isRunning = String(existing.status || "").toLowerCase() === "active" &&
            Number(existing.subscribed_weeks || 0) > 0;
        // A new purchase while the old one is still running adds to it; only an
        // ended subscription starts a fresh period (start_date set on first workout).
        const { subscription } = await addOrderWeeksToSubscription(existing.id, order, (current) => isRunning
            ? {
                ...subscriptionPayload,
                start_date: current.start_date,
                subscribed_weeks: Number(current.subscribed_weeks || 0) + Number(order.purchased_weeks || 0),
            }
            : { ...subscriptionPayload });
        return subscription;
    }

    const created = await upsertSubscriptionRow(order.student_id, order.coach_id, {
        ...subscriptionPayload,
        payment_data: withAppliedOrder(asObject(subscriptionPayload.payment_data as Json), null, order.id) as Json,
    });
    return created;
}

async function applyRenewOrder(
    order: CoachSubscriptionOrderRow,
    confirmedBy: PaymentConfirmedBy,
    alipayOrderId?: string | null,
): Promise<CoachSubscriptionRow> {
    if (!order.subscription_id) {
        throw new Error("续费订单缺少订阅ID");
    }

    const { data: subscription, error } = await serviceRoleSupabase
        .from("coach_subscriptions")
        .select("*")
        .eq("id", order.subscription_id)
        .single();

    if (error || !subscription) {
        throw new Error(error?.message || "订阅不存在");
    }

    if (order.product_id) {
        const result = await applyPaidPackageRenewal({ subscriptionId: subscription.id, sourceKey: `subscription_order:${order.id}`,
            purchase: { productId: order.product_id, productName: order.product_name || '', productTier: order.product_tier || '',
                tier: order.tier, amountFen: order.amount_fen, purchasedWeeks: Number(order.purchased_weeks || 0),
                months: Number(order.purchased_weeks || 0) / 4 }, subscribeData: order.subscribe_data,
            forceQueue: order.product_id !== subscription.product_id || asObject(order.payment_data).package_switch_policy === 'after_current',
            requireQueueSupport: Boolean(asObject(subscription.payment_data).pending_package_switch || asObject(subscription.payment_data).current_package_activation),
            metadata: { paymentMethod: order.payment_method, confirmedBy, paymentOrderId: alipayOrderId || null,
                paymentData: { ...asObject(order.payment_data), pending_renew: null, latest_subscription_order_id: order.id } },
        });
        if (result) {
            if (result.queued) {
                const activation = await activateQueuedPackageIfReady(subscription.id);
                return activation.subscription || result.subscription;
            }
            await refreshSubscriptionEntitlementSnapshot(subscription.id);
            return result.subscription;
        }
    }

    const nowIso = new Date().toISOString();
    const extraWeeks = Number(order.purchased_weeks || 0);
    const { subscription: updated } = await addOrderWeeksToSubscription(subscription.id, order, (current) => {
        const updateData: Record<string, unknown> = {
            status: "active",
            subscribed_weeks: Number(current.subscribed_weeks || 0) + extraWeeks,
            payment_method: order.payment_method,
            payment_confirmed_by: confirmedBy,
            payment_confirmed_at: nowIso,
            coach_seen_at: confirmedBy === "system" ? null : nowIso,
            payment_data: {
                ...asObject(current.payment_data as Json),
                ...asObject(order.payment_data),
                pending_renew: null,
                latest_subscription_order_id: order.id,
            } as Json,
        };
        if (alipayOrderId) {
            updateData.last_payment_order_id = alipayOrderId;
            updateData.order_id = alipayOrderId;
        }
        return updateData;
    });

    const entitlementModel = await refreshSubscriptionEntitlementSnapshot(subscription.id);
    if (entitlementModel?.displayEndDate) {
        return {
            ...(updated as CoachSubscriptionRow),
            end_date: entitlementModel.displayEndDate,
        };
    }

    return updated as CoachSubscriptionRow;
}

export async function upsertSubscriptionOrder(
    input: UpsertSubscriptionOrderInput,
): Promise<CoachSubscriptionOrderRow> {
    const {
        studentId,
        coachId,
        orderType,
        subscriptionId,
        tier,
        amountFen,
        productId,
        productName,
        productTier,
        purchasedWeeks,
        subscribeData,
        packageSwitchPolicy,
    } = input;

    const basePayload = {
        student_id: studentId,
        coach_id: coachId,
        subscription_id: subscriptionId || null,
        order_type: orderType,
        status: "pending_payment",
        payment_method: null,
        amount_fen: Math.round(Number(amountFen || 0)),
        tier,
        product_id: productId || null,
        product_name: productName || null,
        product_tier: productTier || null,
        purchased_weeks: purchasedWeeks ?? null,
        subscribe_data: subscribeData ?? null,
        note: null,
        payment_data: (packageSwitchPolicy ? { package_switch_policy: packageSwitchPolicy } : {}) as Json,
        payment_confirmed_by: null,
        payment_confirmed_at: null,
        coach_seen_at: null,
        alipay_order_id: null,
        updated_at: new Date().toISOString(),
    };

    let query = serviceRoleSupabase
        .from(ORDER_TABLE)
        .select("*")
        .eq("student_id", studentId)
        .eq("coach_id", coachId)
        .eq("order_type", orderType)
        .in("status", ["pending_payment", "pending_confirmation"])
        .order("created_at", { ascending: false })
        .limit(1);

    query = orderType === "renew"
        ? query.eq("subscription_id", subscriptionId || "")
        : query.is("subscription_id", null);
    if (packageSwitchPolicy) {
        // Do not rewrite a package snapshot once a payment has been issued.
        query = query.eq('status', 'pending_payment').is('alipay_order_id', null).eq('product_id', productId || '');
    }

    const { data: existingRows, error: existingError } = await query;
    if (existingError) {
        if (isSubscriptionOrderTableMissingError(existingError.message)) {
            throw new Error(MISSING_ORDER_TABLE_HINT);
        }
        throw new Error(existingError.message);
    }

    const existing = (existingRows || [])[0];
    if (existing?.id) {
        const { data, error } = await serviceRoleSupabase
            .from(ORDER_TABLE)
            .update(basePayload)
            .eq("id", existing.id)
            .select("*")
            .single();

        if (error || !data) {
            if (isSubscriptionOrderTableMissingError(error?.message)) {
                throw new Error(MISSING_ORDER_TABLE_HINT);
            }
            throw new Error(error?.message || "更新订阅订单失败");
        }

        return asOrderRow(data);
    }

    const { data, error } = await serviceRoleSupabase
        .from(ORDER_TABLE)
        .insert(basePayload)
        .select("*")
        .single();

    if (error || !data) {
        if (isSubscriptionOrderTableMissingError(error?.message)) {
            throw new Error(MISSING_ORDER_TABLE_HINT);
        }
        throw new Error(error?.message || "创建订阅订单失败");
    }

    return asOrderRow(data);
}

export async function submitSubscriptionOrderForConfirmation(
    input: SubmitSubscriptionOrderInput,
): Promise<CoachSubscriptionOrderRow> {
    const order = await fetchOrderById(input.orderId);
    if (!order) {
        throw new Error("订阅订单不存在");
    }
    if (order.student_id !== input.studentId) {
        throw new Error("无权提交该订阅订单");
    }
    if (order.status === "paid" || order.status === "cancelled") {
        throw new Error("该订阅订单状态已不可修改");
    }

    const nextPaymentData = {
        ...asObject(order.payment_data),
        ...asObject(input.paymentData),
    } as Json;

    const { data, error } = await serviceRoleSupabase
        .from(ORDER_TABLE)
        .update({
            status: "pending_confirmation",
            payment_method: input.paymentMethod,
            note: input.note ?? null,
            payment_data: nextPaymentData,
            updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .select("*")
        .single();

    if (error || !data) {
        if (isSubscriptionOrderTableMissingError(error?.message)) {
            throw new Error(MISSING_ORDER_TABLE_HINT);
        }
        throw new Error(error?.message || "提交待确认失败");
    }

    const updatedOrder = asOrderRow(data);
    await notifyCoachPendingConfirmation(updatedOrder);
    return updatedOrder;
}

export async function markSubscriptionOrderSeen(
    orderId: string,
    coachUserId: string,
): Promise<CoachSubscriptionOrderRow> {
    const order = await fetchOrderById(orderId);
    if (!order) {
        throw new Error("订阅订单不存在");
    }

    const ownerUserId = await fetchCoachOwnerUserId(order.coach_id);
    if (!ownerUserId || ownerUserId !== coachUserId) {
        throw new Error("无权查看该订阅订单");
    }

    const { data, error } = await serviceRoleSupabase
        .from(ORDER_TABLE)
        .update({
            coach_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .select("*")
        .single();

    if (error || !data) {
        if (isSubscriptionOrderTableMissingError(error?.message)) {
            throw new Error(MISSING_ORDER_TABLE_HINT);
        }
        throw new Error(error?.message || "更新查看状态失败");
    }

    return asOrderRow(data);
}

export async function finalizeSubscriptionOrder(
    input: FinalizeSubscriptionOrderInput,
): Promise<FinalizeSubscriptionOrderResult> {
    const order = await fetchOrderById(input.orderId);
    if (!order) {
        throw new Error("订阅订单不存在");
    }

    if (input.expectedStudentId && order.student_id !== input.expectedStudentId) {
        throw new Error("订单与用户不匹配");
    }

    let subscription: CoachSubscriptionRow | null = null;
    if (order.status === "paid" && order.subscription_id) {
        const { data } = await serviceRoleSupabase
            .from("coach_subscriptions")
            .select("*")
            .eq("id", order.subscription_id)
            .maybeSingle();

        if (data) {
            return {
                order,
                subscription: data as CoachSubscriptionRow,
            };
        }
    }

    subscription = order.order_type === "renew"
        ? await applyRenewOrder(order, input.confirmedBy, input.alipayOrderId)
        : await activateSubscribeOrder(order, input.confirmedBy, input.alipayOrderId);

    const paymentConfirmedAt = new Date().toISOString();
    const { data: paidOrder, error: orderError } = await serviceRoleSupabase
        .from(ORDER_TABLE)
        .update({
            subscription_id: subscription.id,
            status: "paid",
            payment_method: order.payment_method || (input.alipayOrderId ? "platform_alipay" : null),
            payment_confirmed_by: input.confirmedBy,
            payment_confirmed_at: paymentConfirmedAt,
            coach_seen_at: input.confirmedBy === "system" ? null : paymentConfirmedAt,
            alipay_order_id: input.alipayOrderId || order.alipay_order_id || null,
            updated_at: paymentConfirmedAt,
        })
        .eq("id", order.id)
        .select("*")
        .single();

    if (orderError || !paidOrder) {
        if (isSubscriptionOrderTableMissingError(orderError?.message)) {
            throw new Error(MISSING_ORDER_TABLE_HINT);
        }
        throw new Error(orderError?.message || "更新订阅订单状态失败");
    }

    if (order.order_type === "subscribe") {
        await notifyCoachAfterSubscribePaid(
            subscription.id,
            order.coach_id,
            input.confirmedBy,
        );
    } else if (order.order_type === "renew" && asObject(order.payment_data).package_switch_policy !== 'after_current' &&
        (!order.product_id || order.product_id === subscription.product_id) &&
        asObject(subscription.payment_data).current_package_activation?.source_key !== `subscription_order:${order.id}`) {
        await onRenewalPaid(subscription.id).catch((automationError) => {
            console.warn("[subscriptionOrders] renewal automation failed:", automationError);
        });
    }

    return {
        order: asOrderRow(paidOrder),
        subscription,
    };
}

export async function confirmSubscriptionOrderByCoach(
    orderId: string,
    coachUserId: string,
): Promise<FinalizeSubscriptionOrderResult> {
    const order = await fetchOrderById(orderId);
    if (!order) {
        throw new Error("订阅订单不存在");
    }

    const ownerUserId = await fetchCoachOwnerUserId(order.coach_id);
    if (!ownerUserId || ownerUserId !== coachUserId) {
        throw new Error("无权确认该订阅订单");
    }

    if (order.status !== "pending_confirmation") {
        throw new Error("该订阅订单当前不在待确认状态");
    }

    return finalizeSubscriptionOrder({
        orderId,
        confirmedBy: "coach",
    });
}

export async function getSubscriptionOrderById(orderId: string) {
    return fetchOrderById(orderId);
}
