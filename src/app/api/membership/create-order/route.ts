import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { yuanToFen, fenToYuan } from "@/lib/moneyUtils";
import { ApiData } from "@/types/api";
import {
    CreateOrderDto,
    CreateOrderResponse,
} from "@/app/service/studentMembershipService";
import { createAlipaySdk } from "@/lib/alipaySdk";

/**
 * Product configurations
 *
 * IMPORTANT:
 * - Prices here MUST be the real prices used for payment.
 * - If you need to test with "1 cent", set `PAYMENT_TEST_PRICING=true` in dev only.
 *   Production will NEVER enable test pricing (hard guardrail).
 */
const REAL_PRODUCTS: Record<string, { price: number; name: string }> = {
    monthly_basic: { price: 19.9, name: "基础会员 (月)" },
    monthly_premium: { price: 39.9, name: "高级会员 (月)" },
    ai_pack_basic: { price: 2.0, name: "AI 导入加油包 (3次)" },
    storage_pack_basic: { price: 9.9, name: "存储扩容包 (1GB)" },
};

// Use 1-cent pricing ONLY for local/dev verification.
const TEST_PRODUCTS: Record<string, { price: number; name: string }> = {
    monthly_basic: { price: 0.01, name: "基础会员 (月) - Test" },
    monthly_premium: { price: 0.02, name: "高级会员 (月) - Test" },
    ai_pack_basic: { price: 0.01, name: "AI 导入加油包 (Test)" },
    storage_pack_basic: { price: 0.01, name: "存储扩容包 (Test)" },
};

const TEST_PRICING_ENABLED =
    process.env.NODE_ENV !== "production" &&
    process.env.PAYMENT_TEST_PRICING === "true";
const PRODUCTS = TEST_PRICING_ENABLED ? TEST_PRODUCTS : REAL_PRODUCTS;

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const { productKey, paymentMethod }: CreateOrderDto = await request.json();
    // Detect User-Agent for Mobile vs PC
    const userAgent = request.headers.get("user-agent") || "";
    const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            userAgent,
        );

    if (!PRODUCTS[productKey]) {
        return NextResponse.json({
            success: false,
            message: "无效的商品 ID",
            data: null,
        }, { status: 400 });
    }

    const product = PRODUCTS[productKey];
    const amountFen = yuanToFen(product.price);

    // Guardrail: prevent accidentally deploying 1-cent pricing to production.
    if (!TEST_PRICING_ENABLED && process.env.NODE_ENV === "production" && amountFen < 100) {
        return NextResponse.json({
            success: false,
            message: "支付金额配置异常，请联系管理员",
            data: null,
        }, { status: 500 });
    }

    // 1. Create Internal Order Record
    const { data: order, error } = await (supabase
        .from("student_membership_orders" as any)
        .insert({
            user_id: session.user.id,
            product_key: productKey,
            amount: amountFen,
            original_amount: amountFen,
            payment_method: paymentMethod,
            status: "pending",
        })
        .select()
        .single());

    const orderData = order as unknown as { id: string }; // Cast to bypass type check

    if (error) {
        console.error("Error creating internal order:", error);
        return NextResponse.json({
            success: false,
            message: "创建订单失败",
            data: null,
        }, { status: 500 });
    }

    // 2. Create Alipay Order Record AND Generate Payment URL
    // We reuse the logic from `api/payment/alipay/create` but implement it here directly
    // to keep the context specific to membership (e.g., using `order.id` as out_trade_no).

    // However, to link `alipay_orders` table which `notify` updates, we need to insert there too.
    // Simpler approach: Invoke the `alipay-sdk` directly here.

    const {
        ALIPAY_APP_ID,
        ALIPAY_PRIVATE_KEY,
        ALIPAY_PUBLIC_KEY,
        ALIPAY_GATEWAY,
    } = process.env;

    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY || !ALIPAY_PUBLIC_KEY) {
        return NextResponse.json({
            success: false,
            message: "支付配置缺失",
            data: null,
        }, { status: 500 });
    }

    // 使用统一的初始化工具，支持代理配置
    const alipaySdk = createAlipaySdk();

    // Build callback URLs from request headers (works for prod/ngrok, avoids hardcoding).
    const xfProto = request.headers.get("x-forwarded-proto");
    const xfHost = request.headers.get("x-forwarded-host");
    const host = request.headers.get("host");
    const proto = xfProto || (host?.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${xfHost || host}`;

    // Create alipay_orders record to track this transaction for callback
    // We store the `student_membership_orders.id` in `order_data` or use it as `out_trade_no`?
    // Using `student_membership_orders.id` as logic ID is cleaner.
    // But `alipay_orders` is the existing table.
    // Let's use `student_membership_orders.id` as the `out_trade_no` directly?
    // Wait, the existing notify route updates `alipay_orders`.
    // We should allow notify route to ALSO update `student_membership_orders`.

    // BETTER STRATEGY:
    // Use `alipay_orders` as the "Payment Attempt".
    // Store `student_membership_orders.id` inside `alipay_orders.order_data.related_order_id`.

    const { data: alipayOrder, error: alipayError } = await supabase
        .from("alipay_orders")
        .insert({
            subject: product.name,
            total_amount: amountFen,
            order_type: "student_membership", // New type
            order_data: {
                related_order_id: orderData.id,
                product_key: productKey,
            }, // Link back
            user_id: session.user.id,
            status: "pending",
        })
        .select()
        .single();

    if (alipayError) {
        return NextResponse.json({
            success: false,
            message: "创建支付记录失败",
            data: null,
        }, { status: 500 });
    }

    const result = alipaySdk.pageExec(
        isMobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay",
        {
            notifyUrl: `${baseUrl}/api/payment/alipay/notify`,
            returnUrl: `${baseUrl}/api/payment/alipay/return`,
            bizContent: {
                out_trade_no: alipayOrder.id, // Use Alipay Order ID for tracking in Notify
                // Alipay expects a string with up to 2 decimal places.
                total_amount: fenToYuan(amountFen).toFixed(2),
                subject: product.name,
                product_code: isMobile
                    ? "QUICK_WAP_WAY"
                    : "FAST_INSTANT_TRADE_PAY",
                qr_pay_mode: isMobile ? undefined : "2",
            },
        },
    );

    // Return the form HTML. The frontend will render/submit it.
    // Or we can return a URL if we used `method: 'GET'`. `pageExec` returns form HTML string by default.
    // We'll return it as `paymentUrl` for now, but frontend needs to handle it as HTML content if it's not a URL.
    // Actually, create-order frontend code expects `paymentUrl`.
    // If we return HTML form, we can't just `window.location.href = res.paymentUrl`.
    // Let's return `paymentHtml`.

    return NextResponse.json({
        success: true,
        message: "订单创建成功",
        data: {
            orderId: orderData.id,
            paymentHtml: result, // CHANGED from paymentUrl
        },
    });
}
