import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CreateAlipayOrderDto,
    CreateAlipayOrderResponseDto,
} from "./entity";
import { createAlipaySdk } from "@/lib/alipaySdk";
import { yuanToFen, fenToYuan } from "@/lib/moneyUtils";

// 文档：https://opendocs.alipay.com/open/59da99d0_alipay.trade.page.pay?pathHash=e26b497f&scene=22
// 流程和博客：https://kirigaya.cn/blog/article?seq=361
export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const userId = session.user.id;

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

    // 读取参数
    const {
        subject,
        totalAmount,
        orderType,
        orderData = {},
        createMode = "common",
        isMobile = false,
    } = (await req.json()) as CreateAlipayOrderDto;

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
    const coachId = od.coachId as string | undefined;
    const contentId = od.contentId as string | undefined;

    let subjectText = String(subject || "");
    let resolvedTotalAmount = Number(totalAmount);

    if (orderType === "subscription" || orderType === "subscription_renew") {
        if (!subjectText) {
            return NextResponse.json(
                { success: false, message: "缺少必要参数", data: null },
                { status: 400 },
            );
        }
        if (!subscriptionId) {
            return NextResponse.json(
                { success: false, message: "缺少订阅ID，无法创建平台支付订单", data: null },
                { status: 400 },
            );
        }

        const { data: sub, error: subErr } = await serviceRoleSupabase
            .from("coach_subscriptions")
            .select("id, student_id, coach_id, monthly_price")
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
        }
    }

    // Content purchase: never trust client-provided amount/subject.
    if (orderType === "content_purchase") {
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

        resolvedTotalAmount = priceCents / 100;
        subjectText = `购买文章 ${(content as any).title || ""}`.trim();
    }

    // Guardrail: prevent 1-cent undercharge in production unless explicitly enabled for testing.
    const testPricingEnabled =
        process.env.NODE_ENV !== "production" &&
        process.env.PAYMENT_TEST_PRICING === "true";
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

    // 读取支付宝配置
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

    // 初始化 alipay-sdk（使用统一的初始化工具，支持代理配置）
    const alipaySdk = createAlipaySdk();

    // 写入订单到数据库，金额存储为分（整数）
    // 订阅首单：resolvedTotalAmount 已是 sub.monthly_price（分）；其他/续费：前端传的是元，需转分
    const totalAmountFen =
        orderType === "subscription"
            ? Math.round(Number(resolvedTotalAmount))
            : yuanToFen(resolvedTotalAmount);
    const { data: order, error: orderError } = await supabase
        .from("alipay_orders")
        .insert({
            subject: subjectText,
            total_amount: totalAmountFen, // 存储分（整数）
            order_type: orderType,
            order_data: orderData,
            user_id: userId,
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

    // Bind platform payment order to subscription (so notify can auto-confirm/renew)
    try {
        if (
            subscriptionId &&
            (orderType === "subscription" || orderType === "subscription_renew")
        ) {
            await serviceRoleSupabase
                .from("coach_subscriptions")
                .update({
                    order_id: order.id,
                    payment_method: "platform_alipay",
                })
                .eq("id", subscriptionId);
        }
    } catch (e) {
        // Do not block payment creation, but log for investigation
        console.error("[Alipay Create] Bind subscription failed:", e);
    }

    // 根据设备类型选择支付方式
    let result: string;
    if (isMobile) {
        // 移动端使用 wap.pay，可以唤起支付宝APP
            // 支付宝接口需要元（字符串，保留两位小数）
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
        // PC端使用 page.pay，显示二维码
        // 支付宝接口需要元（字符串，保留两位小数）
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
        await supabase
            .from("alipay_orders")
            .delete()
            .eq("id", order.id);

        return NextResponse.json({
            success: false,
            message: "无法创建订单",
            data: result,
        });
    } else if (createMode === "test") {
        await supabase
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
    return NextResponse.json<ApiData<CreateAlipayOrderResponseDto>>({
        success: true,
        message: "订单创建成功",
        data: {
            order: {
                id: order.id.toString(),
                // `alipay_orders` table uses `id` as out_trade_no for Alipay tracking
                out_trade_no: order.id.toString(),
                subject: order.subject,
                total_amount: fenToYuan(order.total_amount), // 转换为元返回给前端
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
