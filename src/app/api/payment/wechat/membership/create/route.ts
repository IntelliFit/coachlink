import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import { getApiUserId } from "@/lib/getApiUserId";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { fenToYuan, yuanToFen } from "@/lib/moneyUtils";
import {
    assertWechatOpenId,
    createWechatXPayParams,
    exchangeWechatXPaySession,
    getWechatXPayConfig,
    type WechatXPayParams,
} from "@/lib/wechatXPay";
import { getMembershipXPayProduct } from "@/lib/wechatXPayProducts";

export const runtime = "nodejs";

interface CreateMembershipWechatPaymentDto {
    productKey: string;
    loginCode: string;
}

interface CreateMembershipWechatPaymentResponse {
    orderId: string;
    outTradeNo: string;
    paymentProvider: "wechat_xpay";
    amount: number;
    paymentParams: WechatXPayParams;
}

const REAL_PRODUCTS: Record<string, { price: number; name: string }> = {
    monthly_basic: { price: 19.9, name: "基础会员（月卡）" },
    monthly_premium: { price: 39.9, name: "高级会员（月卡）" },
    ai_pack_basic: { price: 2, name: "AI 导入加油包（3次）" },
    storage_pack_basic: { price: 9.9, name: "存储扩容包（1GB）" },
};

const TEST_PRODUCTS: Record<string, { price: number; name: string }> = {
    monthly_basic: { price: 0.01, name: "基础会员（月卡）- Test" },
    monthly_premium: { price: 0.02, name: "高级会员（月卡）- Test" },
    ai_pack_basic: { price: 0.01, name: "AI 导入加油包（Test）" },
    storage_pack_basic: { price: 0.01, name: "存储扩容包（Test）" },
};

const TEST_PRICING_ENABLED =
    process.env.NODE_ENV !== "production" &&
    process.env.PAYMENT_TEST_PRICING === "true";

export async function POST(request: NextRequest) {
    try {
        const userId = await getApiUserId(request);
        if (!userId) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "请先登录后再发起支付", data: null },
                { status: 401 },
            );
        }

        const body = (await request.json()) as CreateMembershipWechatPaymentDto;
        const productKey = String(body.productKey || "").trim();
        const product = (TEST_PRICING_ENABLED ? TEST_PRODUCTS : REAL_PRODUCTS)[productKey];
        if (!product) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "无效的商品 ID", data: null },
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

        const session = await exchangeWechatXPaySession(body.loginCode);
        assertWechatOpenId(user.wechat_openid, session.openId);
        const config = getWechatXPayConfig();
        const amountFen = yuanToFen(product.price);
        const xpayProduct = getMembershipXPayProduct(productKey, amountFen);
        if (!xpayProduct) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "虚拟支付商品未配置", data: null },
                { status: 400 },
            );
        }

        const membershipOrderTable = serviceRoleSupabase.from("student_membership_orders" as any);
        const { data: membershipOrder, error: membershipOrderError } = await membershipOrderTable
            .insert({
                user_id: userId,
                product_key: productKey,
                amount: amountFen,
                original_amount: amountFen,
                payment_method: "wechat",
                status: "pending",
            })
            .select()
            .single();
        if (membershipOrderError || !membershipOrder) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: membershipOrderError?.message || "创建会员订单失败", data: null },
                { status: 500 },
            );
        }

        const outTradeNo = randomUUID().replaceAll("-", "");
        const orderData = {
            related_order_id: membershipOrder.id,
            product_key: productKey,
            xpay_out_trade_no: outTradeNo,
            xpay_product_id: xpayProduct.productId,
            xpay_goods_price: amountFen,
            xpay_openid: session.openId,
            xpay_env: config.env,
        };
        const { data: payOrder, error: payOrderError } = await (serviceRoleSupabase.from("alipay_orders") as any)
            .insert({
                subject: product.name,
                total_amount: amountFen,
                order_type: "student_membership",
                order_data: orderData,
                user_id: userId,
                status: "pending",
                qr_code: "",
                payment_provider: "wechat_xpay",
            })
            .select()
            .single();
        if (payOrderError || !payOrder) {
            await membershipOrderTable.update({ status: "failed" }).eq("id", membershipOrder.id);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: payOrderError?.message || "创建支付订单失败", data: null },
                { status: 500 },
            );
        }

        const { params: paymentParams } = createWechatXPayParams({
            sessionKey: session.sessionKey,
            productId: xpayProduct.productId,
            goodsPrice: amountFen,
            outTradeNo,
            attach: `membership:${productKey}`,
        });

        return NextResponse.json<ApiData<CreateMembershipWechatPaymentResponse>>({
            success: true,
            message: "微信虚拟支付订单创建成功",
            data: {
                orderId: String(payOrder.id),
                outTradeNo,
                paymentProvider: "wechat_xpay",
                amount: fenToYuan(amountFen),
                paymentParams,
            },
        });
    } catch (error: any) {
        console.error("[Wechat XPay Membership Create] error:", error);
        const message = error?.message || "创建虚拟支付订单失败";
        const status = /不一致/.test(message) ? 403 : /缺少|无效|失败/.test(message) ? 400 : 500;
        return NextResponse.json<ApiData<null>>(
            { success: false, message, data: null },
            { status },
        );
    }
}
