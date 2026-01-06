import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";
import {
    CreateOrderDto,
    CreateOrderResponse,
} from "@/app/service/studentMembershipService";
import { AlipaySdk } from "alipay-sdk";

// Product configurations - TESTING PRICES
const PRODUCTS: Record<string, { price: number; name: string }> = {
    "monthly_basic": { price: 0.01, name: "基础会员 (月) - Test" },
    "monthly_premium": { price: 0.02, name: "高级会员 (月) - Test" },
    "ai_pack_basic": { price: 0.01, name: "AI 导入加油包 (Test)" },
    "storage_pack_basic": { price: 0.01, name: "存储扩容包 (Test)" },
};

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
    const amount = product.price;

    // 1. Create Internal Order Record
    const { data: order, error } = await (supabase
        .from("student_membership_orders" as any)
        .insert({
            user_id: session.user.id,
            product_key: productKey,
            amount,
            original_amount: product.price,
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

    const alipaySdk = new AlipaySdk({
        appId: ALIPAY_APP_ID,
        privateKey: ALIPAY_PRIVATE_KEY,
        alipayPublicKey: ALIPAY_PUBLIC_KEY,
        gateway: ALIPAY_GATEWAY,
    });

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
            total_amount: amount,
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
            notifyUrl:
                "https://kristan-billowy-prejudicedly.ngrok-free.dev/api/payment/alipay/notify",
            bizContent: {
                out_trade_no: alipayOrder.id, // Use Alipay Order ID for tracking in Notify
                total_amount: amount.toString(),
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
