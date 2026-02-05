import { NextResponse } from "next/server";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type { CreateAlipayOrderResponseDto } from "../entity";
import { createAlipaySdk } from "@/lib/alipaySdk";
import { yuanToFen, fenToYuan } from "@/lib/moneyUtils";

// 访客支付：独立于登录支付，仅用于创建订单与展示二维码
export async function POST(req: Request) {
    // 构建回调地址：优先使用环境变量，否则从请求头推断
    const envNotifyUrl = process.env.ALIPAY_NOTIFY_URL;
    const envReturnUrl = process.env.ALIPAY_RETURN_URL;

    let notifyUrl: string;
    let returnUrl: string;

    if (envNotifyUrl && envReturnUrl) {
        notifyUrl = envNotifyUrl;
        returnUrl = envReturnUrl;
    } else {
        const xfProto = req.headers.get("x-forwarded-proto");
        const xfHost = req.headers.get("x-forwarded-host");
        const host = req.headers.get("host");
        const proto = xfProto || (host?.includes("localhost") ? "http" : "https");
        const baseUrl = `${proto}://${xfHost || host}`;
        notifyUrl = `${baseUrl}/api/payment/alipay/notify`;
        returnUrl = `${baseUrl}/api/payment/alipay/return`;
    }

    const {
        title = "",
        totalAmount,
        orderData = {},
        createMode = "common",
        isMobile = false,
    } = (await req.json()) as {
        title?: string;
        totalAmount: number;
        orderData?: any;
        createMode?: string;
        isMobile?: boolean;
    };

    const contentId = orderData?.contentId as string | undefined;
    if (!contentId) {
        return NextResponse.json(
            { success: false, message: "缺少内容ID，无法创建支付订单", data: null },
            { status: 400 },
        );
    }

    const guestUserId = process.env.ALIPAY_GUEST_USER_ID;
    if (!guestUserId) {
        return NextResponse.json(
            { success: false, message: "访客支付未配置", data: null },
            { status: 500 },
        );
    }

    const { data: content, error: contentErr } = await serviceRoleSupabase
        .from("coach_contents")
        .select(
            `
                id,
                title,
                price_cents,
                coach:coaches(status)
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

    const resolvedTotalAmount = priceCents / 100;
    const subjectText = `购买文章 ${(content as any).title || title || ""}`.trim();

    // Guardrail: prevent 1-cent undercharge unless explicitly enabled for testing.
    const testPricingEnabled = process.env.PAYMENT_TEST_PRICING === "true";
    if (
        process.env.NODE_ENV === "production" &&
        !testPricingEnabled &&
        Number(resolvedTotalAmount) < 1
    ) {
        return NextResponse.json(
            { success: false, message: "支付金额异常，请联系管理员", data: null },
            { status: 400 },
        );
    }

    const {
        ALIPAY_APP_ID,
        ALIPAY_PRIVATE_KEY,
        ALIPAY_PUBLIC_KEY,
        ALIPAY_GATEWAY,
    } = process.env;

    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY || !ALIPAY_PUBLIC_KEY) {
        return NextResponse.json(
            { success: false, message: "支付宝配置不完整", data: null },
            { status: 500 },
        );
    }

    const alipaySdk = createAlipaySdk();

    const totalAmountFen = yuanToFen(resolvedTotalAmount);
    const { data: order, error: orderError } = await supabase
        .from("alipay_orders")
        .insert({
            subject: subjectText,
            total_amount: totalAmountFen,
            order_type: "guest_content_purchase",
            order_data: orderData,
            user_id: guestUserId,
            status: "pending",
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

    let result: string;
    if (isMobile) {
        const totalAmountYuanStr = fenToYuan(totalAmountFen).toFixed(2);
        result = alipaySdk.pageExec("alipay.trade.wap.pay", {
            notifyUrl,
            returnUrl,
            bizContent: {
                out_trade_no: order.id,
                total_amount: totalAmountYuanStr,
                subject: subjectText,
                product_code: "QUICK_WAP_WAY",
            },
        });
    } else {
        const totalAmountYuanStr = fenToYuan(totalAmountFen).toFixed(2);
        result = alipaySdk.pageExec("alipay.trade.page.pay", {
            notifyUrl,
            returnUrl,
            bizContent: {
                out_trade_no: order.id,
                total_amount: totalAmountYuanStr,
                subject: subjectText,
                product_code: "FAST_INSTANT_TRADE_PAY",
                qr_pay_mode: "0",
            },
        });
    }

    if (!result) {
        await supabase.from("alipay_orders").delete().eq("id", order.id);
        return NextResponse.json({
            success: false,
            message: "无法创建订单",
            data: result,
        });
    } else if (createMode === "test") {
        await supabase.from("alipay_orders").delete().eq("id", order.id);
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
            paymentInfo: {
                formHtml: result,
                description: "支付宝扫码支付",
            },
        },
    });
}

