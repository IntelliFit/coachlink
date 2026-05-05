import { NextRequest, NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import { getApiUserId } from "@/lib/getApiUserId";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { fenToYuan, formatYuan, yuanToFen } from "@/lib/moneyUtils";
import {
    createHuifuMiniProgramOrder,
    formatHuifuReqDate,
    parseHuifuPayInfo,
} from "@/lib/huifuMiniProgramPay";

export const runtime = "nodejs";

interface CreateMembershipWechatPaymentDto {
    productKey: string;
}

interface CreateMembershipWechatPaymentResponse {
    orderId: string;
    outTradeNo: string;
    paymentProvider: "wechat";
    amount: number;
    paymentParams: ReturnType<typeof parseHuifuPayInfo>;
}

const REAL_PRODUCTS: Record<string, { price: number; name: string }> = {
    monthly_basic: { price: 19.9, name: "基础会员（月卡）" },
    monthly_premium: { price: 39.9, name: "高级会员（月卡）" },
    ai_pack_basic: { price: 2.0, name: "AI 导入加油包（3次）" },
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
const PRODUCTS = TEST_PRICING_ENABLED ? TEST_PRODUCTS : REAL_PRODUCTS;

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
        const product = PRODUCTS[productKey];

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
                {
                    success: false,
                    message: "当前账号未绑定小程序 openid，请先使用微信快捷登录",
                    data: null,
                },
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

        const amountFen = yuanToFen(product.price);
        if (!Number.isFinite(amountFen) || amountFen <= 0) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "支付金额无效", data: null },
                { status: 400 },
            );
        }

        const membershipOrderTable = serviceRoleSupabase.from(
            "student_membership_orders" as any,
        );
        const { data: membershipOrder, error: membershipOrderError } =
            await membershipOrderTable
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
                {
                    success: false,
                    message: membershipOrderError?.message || "创建会员订单失败",
                    data: null,
                },
                { status: 500 },
            );
        }

        const reqDate = formatHuifuReqDate();
        const subject = product.name;
        const clientIp = getClientIp(request);

        const payOrderTable = serviceRoleSupabase.from("alipay_orders") as any;
        const { data: payOrder, error: payOrderError } = await payOrderTable
            .insert({
                subject,
                total_amount: amountFen,
                order_type: "student_membership",
                order_data: {
                    related_order_id: membershipOrder.id,
                    product_key: productKey,
                    huifu_req_date: reqDate,
                },
                user_id: userId,
                status: "pending",
                qr_code: "",
                payment_provider: "wechat",
            })
            .select()
            .single();

        if (payOrderError || !payOrder) {
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: payOrderError?.message || "创建支付订单失败",
                    data: null,
                },
                { status: 500 },
            );
        }

        try {
            const payResult = await createHuifuMiniProgramOrder({
                reqDate,
                reqSeqId: payOrder.id,
                transAmtYuan: formatYuan(fenToYuan(amountFen)),
                goodsDesc: subject,
                notifyUrl,
                openid: user.wechat_openid,
                appId: miniAppId,
                attach: payOrder.id,
                remark: payOrder.id,
                body: subject,
                clientIp,
            });

            if (payResult.resp_code !== "00000000" && payResult.resp_code !== "00000100") {
                throw new Error(payResult.resp_desc || "汇付下单失败");
            }

            const paymentParams = parseHuifuPayInfo(payResult.pay_info);

            return NextResponse.json<ApiData<CreateMembershipWechatPaymentResponse>>({
                success: true,
                message: "微信支付单创建成功",
                data: {
                    orderId: payOrder.id,
                    outTradeNo: payOrder.id,
                    paymentProvider: "wechat",
                    amount: fenToYuan(amountFen),
                    paymentParams,
                },
            });
        } catch (error: any) {
            await (serviceRoleSupabase.from("alipay_orders") as any)
                .update({
                    status: "failed",
                    trade_status: error?.message || "CREATE_FAILED",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", payOrder.id);

            return NextResponse.json<ApiData<null>>(
                { success: false, message: error?.message || "汇付下单失败", data: null },
                { status: 500 },
            );
        }
    } catch (error: any) {
        console.error("[Huifu Wechat Membership Create] error:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || "创建支付订单失败", data: null },
            { status: 500 },
        );
    }
}
