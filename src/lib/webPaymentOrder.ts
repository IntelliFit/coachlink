import { NextResponse } from "next/server";
import { rejectWechatPurchase } from '@/lib/wechatFreeRelease';
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CreateAlipayOrderDto,
    CreateAlipayOrderResponseDto,
} from "@/app/api/payment/alipay/create/entity";
import { extractHuifuPayTarget } from "@/components/payment/huifuPayInfo";
import { createAlipaySdk } from "@/lib/alipaySdk";
import { yuanToFen, fenToYuan, formatYuan } from "@/lib/moneyUtils";
import { getSubscriptionOrderById } from "@/lib/subscriptionOrders";
import {
    createHuifuMiniProgramOrder,
    createHuifuHostedWebOrder,
    getHuifuWebPayProjectId,
    formatHuifuReqDate,
} from "@/lib/huifuMiniProgramPay";

function parseMaybeJson(value: unknown) {
    if (typeof value !== "string") return value || null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed;
    }
}

function extractHuifuPayInfo(payResult: Record<string, any>) {
    const parsedPayInfo = parseMaybeJson(payResult.pay_info);
    if (parsedPayInfo) return parsedPayInfo;

    const directValue =
        payResult.qr_code ??
        payResult.qrcode ??
        payResult.qrCode ??
        payResult.code_url ??
        payResult.codeUrl ??
        payResult.pay_url ??
        payResult.payUrl ??
        payResult.pay_qr_code ??
        payResult.payQrCode ??
        payResult.alipay_qr_code ??
        payResult.alipayQrCode ??
        payResult.url ??
        payResult.paymentUrl;

    if (typeof directValue === "string" && directValue.trim()) {
        return directValue.trim();
    }

    const nestedData = payResult.data && typeof payResult.data === "object"
        ? extractHuifuPayInfo(payResult.data as Record<string, any>)
        : null;
    if (nestedData) return nestedData;

    return null;
}

function createWechatReturnUrl(req: Request, orderId: string, redirect: unknown) {
    const safeRedirect = typeof redirect === "string" && /^\/(?!\/)/.test(redirect) && !redirect.includes("\\")
        ? redirect
        : "/today-training";
    const url = new URL(`/payment/${orderId}`, process.env.NEXTAUTH_URL || new URL(req.url).origin);
    url.searchParams.set("provider", "wechat");
    url.searchParams.set("redirect", safeRedirect);
    return url.toString();
}

// 文档：https://opendocs.alipay.com/open/59da99d0_alipay.trade.page.pay?pathHash=e26b497f&scene=22
// 流程和博客：https://kirigaya.cn/blog/article?seq=361
export async function createWebPaymentOrder(req: Request, channel: "alipay" | "wechat") {
    const isWechat = channel === "wechat";
    const paused = rejectWechatPurchase(req);
    if (paused) return paused;
    const session = await getServerSession();

    // 构建回调地址：优先使用环境变量（本地开发时可指向线上），否则从请求头推断
    // 环境变量格式：ALIPAY_NOTIFY_URL=https://your-domain.com/api/payment/alipay/notify
    //              ALIPAY_RETURN_URL=https://your-domain.com/api/payment/alipay/return
    const envNotifyUrl = process.env.ALIPAY_NOTIFY_URL;
    const envReturnUrl = process.env.ALIPAY_RETURN_URL;

    let notifyUrl: string;
    let returnUrl: string;

    if (envNotifyUrl && envReturnUrl) {
        // 使用环境变量（本地开发时指向线上地址，或使用 ngrok 等内网穿透）
        notifyUrl = envNotifyUrl;
        returnUrl = envReturnUrl;
        console.log(`[Alipay Create] 使用环境变量回调地址: notify=${notifyUrl}, return=${returnUrl}`);
    } else {
        // 从请求头推断（适用于生产环境或 ngrok）
        const xfProto = req.headers.get("x-forwarded-proto");
        const xfHost = req.headers.get("x-forwarded-host");
        const host = req.headers.get("host");
        const proto = xfProto || (host?.includes("localhost") ? "http" : "https");
        const baseUrl = `${proto}://${xfHost || host}`;
        notifyUrl = `${baseUrl}/api/payment/alipay/notify`;
        returnUrl = `${baseUrl}/api/payment/alipay/return`;
        console.log(`[Alipay Create] 从请求头推断回调地址: notify=${notifyUrl}, return=${returnUrl}`);

        // 警告：本地开发时支付宝无法访问 localhost，建议设置环境变量
        if (host?.includes("localhost") || host?.includes("127.0.0.1")) {
            console.warn(
                `[Alipay Create] ⚠️  检测到本地开发环境，支付宝无法访问 localhost！\n` +
                `建议设置环境变量：\n` +
                `  ALIPAY_NOTIFY_URL=https://你的线上域名/api/payment/alipay/notify\n` +
                `  ALIPAY_RETURN_URL=https://你的线上域名/api/payment/alipay/return\n` +
                `或者使用 ngrok 等内网穿透工具，并设置 x-forwarded-host 头。`
            );
        }
    }

    const huifuNotifyUrl = String(
        process.env.HUIFU_PAY_NOTIFY_URL ||
        process.env.WECHAT_PAY_NOTIFY_URL ||
        notifyUrl.replace(/\/api\/payment\/alipay\/notify$/, "/api/payment/wechat/notify"),
    ).trim();

    // 读取参数
    const {
        subject,
        totalAmount,
        orderType,
        orderData = {},
        createMode = "common",
        isMobile = false,
        returnUrlOnly = false,
    } = (await req.json()) as CreateAlipayOrderDto;

    const isGuestOrder = orderType === "guest_content_purchase";
    if (isGuestOrder) {
        return NextResponse.json(
            { success: false, message: "请使用访客支付接口", data: null },
            { status: 400 },
        );
    }
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const userId = session.user.id;

    if (!totalAmount) {
        return NextResponse.json(
            { success: false, message: "缺少必要参数", data: null },
            { status: 400 },
        );
    }

    // For subscription payments, never trust client-provided totalAmount.
    // We validate ownership/coaching relation and, for initial subscription, override amount from DB.
    const od: any = orderData || {};
    const subscriptionId = od.subscriptionId as string | undefined;
    const subscriptionOrderId = od.subscriptionOrderId as string | undefined;
    const coachId = od.coachId as string | undefined;
    const contentId = od.contentId as string | undefined;

    if (isWechat && (!subscriptionOrderId || !["subscription", "subscription_renew"].includes(String(orderType)))) {
        return NextResponse.json(
            { success: false, message: "微信网页支付需要有效的教练订阅订单", data: null },
            { status: 400 },
        );
    }

    let subjectText = String(subject || "");
    let resolvedTotalAmount = Number(totalAmount);
    let resolvedAmountAlreadyFen = false;
    let subscriptionMeta: {
        coachId: string;
        coachName: string;
        productName: string;
        productTier: string;
        durationMonths: number;
    } | null = null;
    let contentPurchaseMeta: {
        coachId: string;
        coachName: string;
        contentId: string;
        contentTitle: string;
    } | null = null;

    if (orderType === "subscription" || orderType === "subscription_renew") {
        if (!subjectText) {
            return NextResponse.json(
                { success: false, message: "缺少必要参数", data: null },
                { status: 400 },
            );
        }

        if (subscriptionOrderId) {
            const subscriptionOrder = await getSubscriptionOrderById(subscriptionOrderId);
            if (!subscriptionOrder) {
                return NextResponse.json(
                    { success: false, message: "订阅订单不存在，无法创建平台支付订单", data: null },
                    { status: 400 },
                );
            }

            if (subscriptionOrder.student_id !== userId) {
                return NextResponse.json(
                    { success: false, message: "无权为该订阅订单创建支付订单", data: null },
                    { status: 403 },
                );
            }

            if (coachId && subscriptionOrder.coach_id !== coachId) {
                return NextResponse.json(
                    { success: false, message: "订阅订单与教练不匹配，无法创建支付订单", data: null },
                    { status: 400 },
                );
            }

            if (isWechat) {
                const expectedType = orderType === "subscription_renew" ? "renew" : "subscribe";
                if (subscriptionOrder.status !== "pending_payment" || subscriptionOrder.order_type !== expectedType) {
                    return NextResponse.json(
                        { success: false, message: "订阅订单已支付、已取消或支付类型不匹配", data: null },
                        { status: 400 },
                    );
                }
                subjectText = ((expectedType === "renew" ? "续费" : "订阅") + "教练 " + (subscriptionOrder.product_name || "")).trim();
                od.renewAdditionalWeeks = expectedType === "renew" ? subscriptionOrder.purchased_weeks : undefined;
            }

            resolvedTotalAmount = Number(subscriptionOrder.amount_fen || 0);
            if (!resolvedTotalAmount || resolvedTotalAmount <= 0) {
                return NextResponse.json(
                    { success: false, message: "订阅订单金额无效，无法创建平台支付订单", data: null },
                    { status: 400 },
                );
            }
            resolvedAmountAlreadyFen = true;

            if (!subjectText.trim()) {
                subjectText = `${subscriptionOrder.order_type === "renew" ? "续费" : "订阅"}教练 ${subscriptionOrder.product_name || ""}`.trim();
            }

            const renewWeeks = Number(od.renewAdditionalWeeks || 0);
            const baseDurationMonths = Math.max(
                1,
                Math.round(Number(subscriptionOrder.duration_months || 0)),
            );
            const durationMonths =
                orderType === "subscription_renew" && renewWeeks > 0
                    ? Math.max(1, Math.round(renewWeeks / 4))
                    : baseDurationMonths;

            subscriptionMeta = {
                coachId: String(coachId || subscriptionOrder.coach_id || ""),
                coachName: String(subscriptionOrder.coach_name || "").trim(),
                productName: String(subscriptionOrder.product_name || ""),
                productTier: String(subscriptionOrder.product_tier || ""),
                durationMonths,
            };
        } else if (!subscriptionId) {
            return NextResponse.json(
                { success: false, message: "缺少订阅ID，无法创建平台支付订单", data: null },
                { status: 400 },
            );
        } else {
            const { data: sub, error: subErr } = await serviceRoleSupabase
                .from("coach_subscriptions")
                .select("id, student_id, coach_id, monthly_price, product_name, product_tier, subscribed_weeks, coaches(name)")
                .eq("id", subscriptionId)
                .single();
            if (subErr || !sub) {
                return NextResponse.json(
                    { success: false, message: "订阅不存在，无法创建平台支付订单", data: null },
                    { status: 400 },
                );
            }

            if (sub.student_id !== userId) {
                return NextResponse.json(
                    { success: false, message: "无权为该订阅创建支付订单", data: null },
                    { status: 403 },
                );
            }

            if (coachId && sub.coach_id !== coachId) {
                return NextResponse.json(
                    { success: false, message: "订阅与教练不匹配，无法创建支付订单", data: null },
                    { status: 400 },
                );
            }

            // Initial subscription: monthly_price 在 DB 中已存为分（整数），直接作为订单金额（分）
            // Renewals may have different tiered discounts; we keep client-provided totalAmount (yuan) and convert to fen below.
            if (orderType === "subscription") {
                resolvedTotalAmount = Number(sub.monthly_price);
                resolvedAmountAlreadyFen = true;
            }

            const coachName = String((sub as any)?.coaches?.name || "");
            const productName = String((sub as any)?.product_name || "");
            const productTier = String((sub as any)?.product_tier || "");
            const baseDurationMonths = Math.max(1, Math.round(Number((sub as any)?.subscribed_weeks || 0) / 4));
            const renewWeeks = Number(od.renewAdditionalWeeks || 0);
            const durationMonths =
                orderType === "subscription_renew" && renewWeeks > 0
                    ? Math.max(1, Math.round(renewWeeks / 4))
                    : baseDurationMonths;

            subscriptionMeta = {
                coachId: String(coachId || sub.coach_id || ""),
                coachName: coachName.trim(),
                productName,
                productTier,
                durationMonths,
            };
        }

        if (subscriptionMeta) {
            Object.assign(od, {
                ...od,
                subscriptionId,
                subscription_id: subscriptionId,
                coachId: subscriptionMeta.coachId,
                coachName: subscriptionMeta.coachName,
                productName: subscriptionMeta.productName,
                product_name: subscriptionMeta.productName,
                productTier: subscriptionMeta.productTier,
                product_tier: subscriptionMeta.productTier,
                durationMonths: subscriptionMeta.durationMonths,
                duration_months: subscriptionMeta.durationMonths,
            });
        }
    }

    // Content purchase: never trust client-provided amount/subject.
    if (orderType === "content_purchase" || orderType === "guest_content_purchase") {
        if (!contentId) {
            return NextResponse.json(
                { success: false, message: "缺少内容ID，无法创建支付订单", data: null },
                { status: 400 },
            );
        }

        const { data: content, error: contentErr } = await serviceRoleSupabase
            .from("coach_contents")
            .select(
                `
                id,
                title,
                price_cents,
                coach_id,
                coach:coaches(id,name,status)
            `,
            )
            .eq("id", contentId)
            .maybeSingle();

        if (contentErr || !content) {
            return NextResponse.json(
                { success: false, message: "内容不存在，无法创建支付订单", data: null },
                { status: 400 },
            );
        }
        if ((content as any)?.coach?.status !== "approved") {
            return NextResponse.json(
                { success: false, message: "内容不可购买", data: null },
                { status: 400 },
            );
        }

        const priceCents = Number((content as any).price_cents ?? 0);
        if (!priceCents || priceCents <= 0) {
            return NextResponse.json(
                { success: false, message: "该内容为免费内容，无需支付", data: null },
                { status: 400 },
            );
        }

        resolvedTotalAmount = priceCents / 100;
        contentPurchaseMeta = {
            coachId: String((content as any).coach_id || ""),
            coachName: String((content as any)?.coach?.name || "").trim(),
            contentId,
            contentTitle: String((content as any).title || "").trim(),
        };
        Object.assign(od, {
            contentId,
            content_id: contentId,
            coachId: contentPurchaseMeta.coachId,
            coachName: contentPurchaseMeta.coachName,
            contentTitle: contentPurchaseMeta.contentTitle,
        });
        subjectText = `购买文章 ${(content as any).title || ""}`.trim();
    }

    // 写入订单到数据库，金额存储为分（整数）
    // 订阅首单：resolvedTotalAmount 已是 sub.monthly_price（分）；其他/续费：前端传的是元，需转分
    const effectiveOrderType =
        subscriptionMeta?.coachId && (orderType === "subscription" || orderType === "subscription_renew")
            ? (orderType === "subscription_renew" ? "coach_subscription_renew" : "coach_subscription")
            : orderType;
    const isCoachSubscription =
        orderType === "subscription" || orderType === "subscription_renew";
    const huifuRevenueCoachId =
        subscriptionMeta?.coachId ||
        (orderType === "content_purchase" ? contentPurchaseMeta?.coachId : undefined);
    const pendingHuifuReqDate = huifuRevenueCoachId ? formatHuifuReqDate() : undefined;

    const totalAmountFen = resolvedAmountAlreadyFen
        ? Math.round(Number(resolvedTotalAmount))
        : yuanToFen(resolvedTotalAmount);
    if (isWechat && !getHuifuWebPayProjectId()) {
        return NextResponse.json(
            { success: false, message: "网页微信支付尚未配置，请联系平台", data: null },
            { status: 503 },
        );
    }
    const { data: order, error: orderError } = await serviceRoleSupabase
            .from("alipay_orders")
            .insert({
                subject: subjectText,
                total_amount: totalAmountFen, // 存储分（整数）
                order_type: effectiveOrderType,
                order_data: {
                    ...od,
                    ...(pendingHuifuReqDate ? { huifu_req_date: pendingHuifuReqDate } : {}),
                    huifu_payment_mode: isWechat ? "hosting" : undefined,
                    ...(isWechat ? { huifu_trade_type: "T_JSAPI" } : {}),
                    original_order_type: effectiveOrderType !== orderType ? orderType : undefined,
                },
                user_id: userId,
                status: "pending",
                ...(isWechat ? { payment_provider: "wechat" } : {}),
                qr_code: "",
            })
        .select()
        .single();

    if (orderError) {
        return NextResponse.json({
            success: false,
            message: orderError.message,
            data: "创建支付订单失败",
        });
    }

    // Bind platform payment order to subscription (so notify can auto-confirm/renew)
    try {
        if (subscriptionOrderId && (orderType === "subscription" || orderType === "subscription_renew")) {
            const { error: bindError } = await serviceRoleSupabase
                .from("coach_subscription_orders" as any)
                .update({
                    alipay_order_id: order.id,
                    payment_method: isWechat ? "platform_wechat" : "platform_alipay",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", subscriptionOrderId)
                .eq("student_id", userId);
            if (isWechat && bindError) throw new Error(bindError.message);
        }

        if (
            !subscriptionOrderId &&
            subscriptionId &&
            (orderType === "subscription" || orderType === "subscription_renew")
        ) {
            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update({
                    order_id: order.id,
                    payment_method: isWechat ? "platform_wechat" : "platform_alipay",
                })
                .eq("id", subscriptionId);
        }
    } catch (e) {
        // Do not block payment creation, but log for investigation
        console.error("[Alipay Create] Bind subscription failed:", e);
        if (isWechat) {
            await serviceRoleSupabase.from("alipay_orders")
                .update({ status: "failed", trade_status: "BIND_FAILED" })
                .eq("id", order.id);
            return NextResponse.json(
                { success: false, message: "关联订阅订单失败，请稍后重试", data: null },
                { status: 500 },
            );
        }
    }

    // 教练款继续使用汇付；托管收银台负责网页微信的授权与手机/电脑支付入口。
    if (huifuRevenueCoachId) {
        const { data: coachRecord } = await serviceRoleSupabase
            .from("coaches")
            .select("huifu_id, huifu_open_status, huifu_card_token")
            .eq("id", huifuRevenueCoachId)
            .maybeSingle();

        if (coachRecord?.huifu_id && coachRecord.huifu_open_status === "opened" && coachRecord.huifu_card_token) {
            const reqDate = String(((order.order_data as any)?.huifu_req_date || pendingHuifuReqDate || formatHuifuReqDate())).trim();
            const alipayBuyerId = String(od.alipayBuyerId || od.buyerId || "").trim();
            const alipayBuyerLogonId = String(od.alipayBuyerLogonId || od.buyerLogonId || "").trim();
            // Web browsers do not normally know the Alipay buyer id/logon id. A_JSAPI requires one of
            // those buyer identifiers, so the web flow must default to A_NATIVE QR payment.
            const huifuTradeType =
                isWechat ? "T_JSAPI" : (isMobile && (alipayBuyerId || alipayBuyerLogonId) ? "A_JSAPI" : "A_NATIVE");

            try {
                const payParams = {
                    reqDate,
                    reqSeqId: order.id,
                    transAmtYuan: formatYuan(fenToYuan(totalAmountFen)),
                    goodsDesc: subjectText,
                    notifyUrl: huifuNotifyUrl,
                    acctId: process.env.HUIFU_CASH_ACCT_ID || "F22836659",
                };
                const payResult = isWechat
                    ? await createHuifuHostedWebOrder({
                        ...payParams,
                        mobile: Boolean(isMobile) || /MicroMessenger/i.test(req.headers.get("user-agent") || ""),
                        callbackUrl: createWechatReturnUrl(req, order.id, od.redirect),
                    })
                    : await createHuifuMiniProgramOrder({
                        ...payParams,
                        openid: "",
                        appId: "",
                        tradeType: huifuTradeType,
                        alipayData: {
                            subject: subjectText,
                            buyer_id: alipayBuyerId || undefined,
                            buyer_logon_id: alipayBuyerLogonId || undefined,
                        },
                        clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
                        feeFlag: 2,
                    });

                if (payResult.resp_code !== "00000000" && payResult.resp_code !== "00000100") {
                    throw new Error(payResult.resp_desc || "汇付下单失败");
                }

                const rawHuifuPayInfo = isWechat
                    ? String(payResult.jump_url || "").trim()
                    : extractHuifuPayInfo(payResult as Record<string, any>);

                if (!rawHuifuPayInfo || (isWechat && !/^https:\/\//i.test(String(rawHuifuPayInfo)))) {
                    console.error("[Alipay Create] Huifu order created without usable pay info", {
                        orderId: order.id,
                        tradeType: huifuTradeType,
                        responseKeys: Object.keys(payResult || {}),
                        respCode: payResult.resp_code,
                        respDesc: payResult.resp_desc,
                    });
                    throw new Error("汇付下单成功但未返回可展示的支付参数");
                }

                // Keep local query/reconciliation on the Huifu gateway even if callbacks are delayed.
                const { error: markHuifuOrderError } = await serviceRoleSupabase
                    .from("alipay_orders")
                    .update({
                        order_type: effectiveOrderType,
                        order_data: {
                            ...od,
                            huifu_req_date: reqDate,
                            huifu_trade_type: huifuTradeType,
                            huifu_payment_mode: isWechat ? "hosting" : undefined,
                            ...(isWechat ? { huifu_pre_order_id: payResult.pre_order_id } : {}),
                            original_order_type: orderType,
                        },
                        ...(isWechat ? { payment_provider: "wechat", qr_code: extractHuifuPayTarget(rawHuifuPayInfo) } : {}),
                    })
                    .eq("id", order.id);
                if (markHuifuOrderError) {
                    console.error("[Alipay Create] Failed to mark Huifu order locally:", {
                        orderId: order.id,
                        message: markHuifuOrderError.message,
                    });
                }

                return NextResponse.json<ApiData<any>>({
                    success: true,
                    message: "订单创建成功",
                    data: {
                        order: {
                            id: order.id.toString(),
                            out_trade_no: order.id.toString(),
                            subject: order.subject,
                            total_amount: fenToYuan(order.total_amount),
                            status: order.status,
                            created_at: order.created_at,
                        },
                        paymentInfo: {
                            provider: isWechat ? "huifu_wechat" : "huifu_alipay",
                            ...(isWechat ? { paymentMode: "hosting" } : {}),
                            tradeType: huifuTradeType,
                            payInfo: rawHuifuPayInfo,
                        },
                    },
                });
            } catch (error: any) {
                await serviceRoleSupabase
                    .from("alipay_orders")
                    .update({
                        status: "failed",
                        trade_status: error?.message || "CREATE_FAILED",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", order.id);

                return NextResponse.json(
                    { success: false, message: error?.message || "汇付下单失败", data: null },
                    { status: 500 },
                );
            }
        }
    }

    if (isCoachSubscription || orderType === "content_purchase") {
        await serviceRoleSupabase
            .from("alipay_orders")
            .update({
                status: "failed",
                trade_status: "COACH_HUIFU_NOT_READY",
                updated_at: new Date().toISOString(),
            })
            .eq("id", order.id);

        return NextResponse.json(
            { success: false, message: "教练汇付收款账户尚未完整开通，请教练先重新完成收款账户绑定", data: null },
            { status: 400 },
        );
    }

    // ── 非教练订阅：保留原支付宝直连 ──

    const {
        ALIPAY_APP_ID,
        ALIPAY_PRIVATE_KEY,
        ALIPAY_PUBLIC_KEY,
    } = process.env;

    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY || !ALIPAY_PUBLIC_KEY) {
        return NextResponse.json(
            { success: false, message: "支付宝配置不完整", data: null },
            { status: 500 },
        );
    }

    // 初始化 alipay-sdk（使用统一的初始化工具，支持代理配置）
    const alipaySdk = createAlipaySdk();

    // 根据设备类型选择支付方式；returnUrlOnly 时传 'GET' 得到跳转 URL，否则得到 form HTML
    const bizCommon = {
        notifyUrl,
        returnUrl,
    };
    let result: string;
    if (isMobile) {
        const totalAmountYuanStr = fenToYuan(totalAmountFen).toFixed(2);
        const bizParams = {
            ...bizCommon,
            bizContent: {
                out_trade_no: order.id,
                total_amount: totalAmountYuanStr,
                subject: subjectText,
                product_code: "QUICK_WAP_WAY",
            },
        };
        result = returnUrlOnly
            ? (alipaySdk.pageExec("alipay.trade.wap.pay", "GET", bizParams) as string)
            : (alipaySdk.pageExec("alipay.trade.wap.pay", bizParams) as string);
    } else {
        const totalAmountYuanStr = fenToYuan(totalAmountFen).toFixed(2);
        const bizParams = {
            ...bizCommon,
            bizContent: {
                out_trade_no: order.id,
                total_amount: totalAmountYuanStr,
                subject: subjectText,
                product_code: "FAST_INSTANT_TRADE_PAY",
                qr_pay_mode: "0",
            },
        };
        result = returnUrlOnly
            ? (alipaySdk.pageExec("alipay.trade.page.pay", "GET", bizParams) as string)
            : (alipaySdk.pageExec("alipay.trade.page.pay", bizParams) as string);
    }

    if (!result) {
        await serviceRoleSupabase
            .from("alipay_orders")
            .delete()
            .eq("id", order.id);

        return NextResponse.json({
            success: false,
            message: "无法创建订单",
            data: result,
        });
    } else if (createMode === "test") {
        await serviceRoleSupabase
            .from("alipay_orders")
            .delete()
            .eq("id", order.id);
    }

    if (orderError) {
        return NextResponse.json(
            { success: false, message: "订单写入失败", data: null },
            { status: 500 },
        );
    }

    // 返回响应
    const paymentInfo: CreateAlipayOrderResponseDto["paymentInfo"] = {
        formHtml: returnUrlOnly ? "" : result,
        description: "支付宝扫码支付",
    };
    if (returnUrlOnly && result) {
        paymentInfo.paymentUrl = result;
    }

    return NextResponse.json<ApiData<CreateAlipayOrderResponseDto>>({
        success: true,
        message: "订单创建成功",
        data: {
            order: {
                id: order.id.toString(),
                out_trade_no: order.id.toString(),
                subject: order.subject,
                total_amount: fenToYuan(order.total_amount),
                status: order.status,
                created_at: order.created_at,
            },
            paymentInfo,
        },
    });
}
