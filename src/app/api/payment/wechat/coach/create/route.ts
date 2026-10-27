import { NextRequest, NextResponse } from "next/server";
import { rejectWechatCoachPurchase } from '@/lib/wechatFreeRelease';
import type { ApiData } from "@/types/api";
import { getApiUserId } from "@/lib/getApiUserId";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { fenToYuan, formatYuan } from "@/lib/moneyUtils";
import { assertPackageQueueAvailable, getPackagePurchase, PACKAGE_SWITCH_POLICY } from '@/lib/subscriptionPackageQueue';
import {
    PAYMENT_DUPLICATE_MESSAGE,
    PAYMENT_DUPLICATE_WINDOW_MS,
    getRenewPurchaseMismatch,
    getRenewRequestError,
    isRecentPendingOrder,
} from '@/lib/coachRenewalCheckout';
import {
    createHuifuMiniProgramOrder,
    formatHuifuReqDate,
    parseHuifuPayInfo,
} from "@/lib/huifuMiniProgramPay";

export const runtime = "nodejs";

function getClientIp(request: NextRequest) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const first = forwardedFor.split(",")[0]?.trim();
        if (first) return first;
    }
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
    return "127.0.0.1";
}

interface CreateCoachWechatPaymentDto {
    coachId: string;
    subscriptionId: string;
    amount?: number;
    renew?: boolean;
    renewAdditionalWeeks?: number;
    subject?: string;
    testAmountFen?: number;
    productId?: string;
    months?: number;
}

interface CreateCoachWechatPaymentResponse {
    orderId: string;
    outTradeNo: string;
    paymentProvider: "wechat";
    amount: number;
    paymentParams: ReturnType<typeof parseHuifuPayInfo>;
    packageSwitchPolicy?: typeof PACKAGE_SWITCH_POLICY;
}

export async function POST(request: NextRequest) {
    const paused = rejectWechatCoachPurchase(request, { wechatOnly: true });
    if (paused) return paused;
    try {
        const testPricingEnabled = process.env.NODE_ENV !== "production";
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "请先登录后再发起支付", data: null },
                { status: 401 },
            );
        }

        const body = (await request.json()) as CreateCoachWechatPaymentDto;
        const coachId = String(body.coachId || "").trim();
        const subscriptionId = String(body.subscriptionId || "").trim();
        const renew = body.renew === true;
        const renewAdditionalWeeks = Number(body.renewAdditionalWeeks || 0);
        const testAmountFen = Math.round(Number(body.testAmountFen || 0));
        const isTestPayment = testPricingEnabled && testAmountFen > 0;

        if (!coachId || !subscriptionId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少必要参数", data: null },
                { status: 400 },
            );
        }

        const { data: user, error: userError } = await serviceRoleSupabase
            .from("users")
            .select("id, wechat_openid")
            .eq("id", userId)
            .maybeSingle();

        if (userError || !user) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "查询用户失败", data: null },
                { status: 500 },
            );
        }

        if (!user.wechat_openid) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "当前账号未绑定小程序 openid，请先使用微信快捷登录", data: null },
                { status: 400 },
            );
        }

        const { data: subscription, error: subError } = await serviceRoleSupabase
            .from("coach_subscriptions")
            .select("id, student_id, coach_id, status, monthly_price, product_id, product_name, product_tier, subscribed_weeks, coaches(name)")
            .eq("id", subscriptionId)
            .single();

        if (subError || !subscription) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "订阅不存在", data: null },
                { status: 404 },
            );
        }

        if (subscription.student_id !== userId || subscription.coach_id !== coachId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "无权为该订阅发起支付", data: null },
                { status: 403 },
            );
        }

        if (!renew && subscription.status === "waiting") {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "当前订阅正在处理中，请稍后再试", data: null },
                { status: 400 },
            );
        }

        const renewRequestError = getRenewRequestError({
            renew,
            productId: body.productId,
            renewAdditionalWeeks,
            isTestPayment,
        });
        if (renewRequestError) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: renewRequestError, data: null },
                { status: 400 },
            );
        }

        if (renew && !["active", "expired", "near_expiry"].includes(String(subscription.status || ""))) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "当前订阅状态不支持续费", data: null },
                { status: 400 },
            );
        }

        // Renewal price and weeks always come from the coach's package list, never the client.
        let purchase: Awaited<ReturnType<typeof getPackagePurchase>> | null = null;
        if (renew && body.productId) {
            try {
                purchase = await getPackagePurchase(coachId, body.productId, Number(body.months ?? renewAdditionalWeeks / 4));
            } catch (error: any) {
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: error?.message || "无法核对套餐价格，请刷新后重试", data: null },
                    { status: 400 },
                );
            }
            const mismatch = getRenewPurchaseMismatch(purchase, { renewAdditionalWeeks, amountYuan: body.amount });
            if (mismatch) {
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: mismatch, data: null },
                    { status: 400 },
                );
            }
        }
        const isPackageSwitch = Boolean(purchase && purchase.productId !== subscription.product_id);
        if (isPackageSwitch) await assertPackageQueueAvailable();

        // 教练订阅必须保留汇付真实分账闭环。
        const { data: coachRecord } = await serviceRoleSupabase
            .from("coaches")
            .select("huifu_id, huifu_open_status, huifu_card_token")
            .eq("id", coachId)
            .maybeSingle();

        if (!coachRecord?.huifu_id || coachRecord.huifu_open_status !== "opened" || !coachRecord.huifu_card_token) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "教练汇付收款账户尚未完整开通，请教练先重新完成收款账户绑定", data: null },
                { status: 400 },
            );
        }

        const notifyUrl = String(process.env.WECHAT_PAY_NOTIFY_URL || "").trim();
        const miniAppId = String(process.env.WECHAT_MINIAPP_APPID || "").trim();
        if (!notifyUrl || !miniAppId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "微信支付配置不完整，请联系管理员", data: null },
                { status: 500 },
            );
        }

        if (testAmountFen > 0 && !testPricingEnabled) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "测试支付仅开发环境可用", data: null },
                { status: 400 },
            );
        }

        const totalAmountFen = isTestPayment
            ? testAmountFen
            : purchase
                ? purchase.amountFen
                : renew
                    ? 0
                    : Math.round(Number(subscription.monthly_price || 0));

        if (!Number.isFinite(totalAmountFen) || totalAmountFen <= 0) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "支付金额无效", data: null },
                { status: 400 },
            );
        }

        const subject = String(
            body.subject ||
                `订阅教练 ${subscription.product_name || ""}`.trim() ||
                (renew ? "教练订阅续费" : "订阅教练"),
        ).trim();

        const reqDate = formatHuifuReqDate();
        const orderType = renew ? "coach_subscription_renew" : "coach_subscription";
        const clientIp = getClientIp(request);
        const coachName = String((subscription as any)?.coaches?.name || "").trim();
        const baseDurationMonths = Math.max(1, Math.round(Number(subscription.subscribed_weeks || 0) / 4));
        const durationMonths = renew
            ? Math.max(1, Math.round(renewAdditionalWeeks / 4))
            : baseDurationMonths;
        const orderData = {
            coachId,
            coachName,
            subscriptionId,
            subscription_id: subscriptionId,
            productId: purchase?.productId || subscription.product_id,
            productName: purchase?.productName || String(subscription.product_name || "").trim(),
            product_name: purchase?.productName || String(subscription.product_name || "").trim(),
            productTier: purchase?.productTier || String(subscription.product_tier || "").trim(),
            product_tier: purchase?.productTier || String(subscription.product_tier || "").trim(),
            packagePurchase: purchase || undefined,
            packageSwitchPolicy: isPackageSwitch ? PACKAGE_SWITCH_POLICY : undefined,
            durationMonths,
            duration_months: durationMonths,
            renewAdditionalWeeks: renew ? renewAdditionalWeeks : undefined,
            huifu_req_date: reqDate,
            is_test_payment: testPricingEnabled && testAmountFen > 0,
        };

        // Best-effort guard against double taps; the client also locks while a payment is starting.
        const { data: recentOrders } = await (serviceRoleSupabase
            .from("alipay_orders") as any)
            .select("id, created_at")
            .eq("user_id", userId)
            .eq("order_type", orderType)
            .eq("status", "pending")
            .eq("order_data->>subscriptionId", subscriptionId)
            .gte("created_at", new Date(Date.now() - PAYMENT_DUPLICATE_WINDOW_MS).toISOString())
            .limit(1);
        if ((recentOrders || []).some((row: { created_at: string }) => isRecentPendingOrder(row.created_at))) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: PAYMENT_DUPLICATE_MESSAGE, data: null },
                { status: 409 },
            );
        }

        const { data: order, error: orderError } = await (serviceRoleSupabase
            .from("alipay_orders") as any)
            .insert({
                subject,
                total_amount: totalAmountFen,
                order_type: orderType,
                order_data: orderData,
                user_id: userId,
                status: "pending",
                qr_code: "",
                payment_provider: "wechat",
            })
            .select()
            .single();

        if (orderError || !order) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: orderError?.message || "创建支付订单失败", data: null },
                { status: 500 },
            );
        }

        // Renewals record their order on the subscription only once paid (fulfillPaidOrder);
        // binding an unpaid renewal here would point the live subscription at a pending/failed order.
        if (!renew) {
            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update({ order_id: order.id, payment_method: "platform_wechat" })
                .eq("id", subscriptionId);
        }

        try {
            const payResult = await createHuifuMiniProgramOrder({
                reqDate,
                reqSeqId: order.id,
                transAmtYuan: formatYuan(fenToYuan(totalAmountFen)),
                goodsDesc: subject,
                notifyUrl,
                openid: user.wechat_openid,
                appId: miniAppId,
                attach: order.id,
                remark: order.id,
                body: subject,
                clientIp,
                feeFlag: 2,
                acctId: process.env.HUIFU_CASH_ACCT_ID || "F22836659",
            });

            if (payResult.resp_code !== "00000000" && payResult.resp_code !== "00000100") {
                throw new Error(payResult.resp_desc || "汇付下单失败");
            }

            const paymentParams = parseHuifuPayInfo(payResult.pay_info);

            return NextResponse.json<ApiData<CreateCoachWechatPaymentResponse>>({
                success: true,
                message: "微信支付单创建成功",
                data: {
                    orderId: order.id,
                    outTradeNo: order.id,
                    paymentProvider: "wechat",
                    amount: fenToYuan(totalAmountFen),
                    paymentParams,
                    packageSwitchPolicy: isPackageSwitch ? PACKAGE_SWITCH_POLICY : undefined,
                },
            });
        } catch (error: any) {
            await (serviceRoleSupabase.from("alipay_orders") as any)
                .update({
                    status: "failed",
                    trade_status: error?.message || "CREATE_FAILED",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", order.id);

            return NextResponse.json<ApiData<null>>(
                { success: false, message: error?.message || "汇付下单失败", data: null },
                { status: 500 },
            );
        }
    } catch (error: any) {
        console.error("[Huifu Wechat Coach Create] error:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || "创建支付订单失败", data: null },
            { status: 500 },
        );
    }
}
