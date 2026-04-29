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
}

interface CreateCoachWechatPaymentResponse {
    orderId: string;
    outTradeNo: string;
    paymentProvider: "wechat";
    amount: number;
    paymentParams: ReturnType<typeof parseHuifuPayInfo>;
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

        const body = (await request.json()) as CreateCoachWechatPaymentDto;
        const coachId = String(body.coachId || "").trim();
        const subscriptionId = String(body.subscriptionId || "").trim();
        const renew = body.renew === true;
        const renewAdditionalWeeks = Number(body.renewAdditionalWeeks || 0);

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
            .select("id, student_id, coach_id, status, monthly_price, product_name, product_tier, subscribed_weeks, coaches(name)")
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

        if (renew && renewAdditionalWeeks <= 0) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "续费周数无效", data: null },
                { status: 400 },
            );
        }

        if (renew && !["active", "expired", "near_expiry"].includes(String(subscription.status || ""))) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "当前订阅状态不支持续费", data: null },
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

        const totalAmountFen = renew
            ? yuanToFen(body.amount)
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
        const orderType = renew ? "subscription_renew" : "subscription";
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
            productName: String(subscription.product_name || "").trim(),
            product_name: String(subscription.product_name || "").trim(),
            productTier: String(subscription.product_tier || "").trim(),
            product_tier: String(subscription.product_tier || "").trim(),
            durationMonths,
            duration_months: durationMonths,
            renewAdditionalWeeks: renew ? renewAdditionalWeeks : undefined,
            huifu_req_date: reqDate,
        };

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

        await serviceRoleSupabase
            .from("coach_subscriptions")
            .update({
                order_id: order.id,
                payment_method: "platform_wechat",
            })
            .eq("id", subscriptionId);

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
