import { NextResponse } from "next/server";
import { rejectWechatPurchase } from '@/lib/wechatFreeRelease';
import { createAlipaySdk } from "@/lib/alipaySdk";
import { fenToYuan } from "@/lib/moneyUtils";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import {
  assertWechatOpenId,
  createWechatXPayParams,
  exchangeWechatXPaySession,
  getWechatXPayConfig,
} from "@/lib/wechatXPay";
import { getMotionEffectXPayProduct } from "@/lib/wechatXPayProducts";
import { randomUUID } from "node:crypto";
import type { ApiData } from "@/types/api";
import {
  calculateMotionEffectPrice,
  createOrderClaimHash,
  getAccessibleMotionEffectJob,
  getGuestPaymentUserId,
  getMotionEffectRequestIdentity,
  hasSignupFreeExport,
  normalizeExportQuality,
  normalizeQueueTier,
} from "../../../_commerce";
import { mapMotionEffectJob } from "../../../_helpers";
import type { MotionEffectCheckoutDto } from "../../../types";

export const runtime = "nodejs";
const db = serviceRoleSupabase as any;

function baseUrlFor(req: Request) {
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const paused = rejectWechatPurchase(req);
  if (paused) return paused;
  const requestBody = (await req.json().catch(() => ({}))) as {
    paymentProvider?: "alipay" | "wechat";
    returnUrlOnly?: boolean;
    loginCode?: string;
  };
  const returnUrlOnly = requestBody?.returnUrlOnly === true;
  const paymentProvider =
    requestBody?.paymentProvider === "wechat" ? "wechat" : "alipay";
  if (paymentProvider === 'wechat') {
    const wechatPaused = rejectWechatPurchase(req, { wechatOnly: true });
    if (wechatPaused) return wechatPaused;
  }
  const storedPaymentProvider = paymentProvider === "wechat" ? "wechat_xpay" : "alipay";
  const identity = await getMotionEffectRequestIdentity(req);
  const { id } = await context.params;
  const job = await getAccessibleMotionEffectJob(id, identity);
  if (!job) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "任务不存在", data: null },
      { status: 404 },
    );
  }
  if (!["awaiting_upload", "awaiting_payment"].includes(job.status)) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "当前任务状态不能创建支付订单", data: null },
      { status: 409 },
    );
  }

  const info = await db.storage
    .from(job.input_storage_bucket || "videos")
    .info(job.input_storage_path);
  const expected = Number(job.original_file_size_bytes || 0);
  const actual = Number(info.data?.size ?? info.data?.metadata?.size ?? 0);
  if (info.error || expected <= 0 || actual <= 0 || Math.abs(expected - actual) > 1024) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "请先完整上传视频，再进行支付", data: null },
      { status: 400 },
    );
  }

  let reusableOrder: any = null;
  if (job.payment_order_id) {
    const { data: existingOrder } = await db
      .from("alipay_orders")
      .select("id,status,total_amount,payment_provider,order_data")
      .eq("id", job.payment_order_id)
      .maybeSingle();
    if (existingOrder?.status === "paid") {
      await db
        .from("tool_video_render_jobs")
        .update({ payment_status: "paid", status: "awaiting_upload" })
        .eq("id", id);
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "订单已经支付，可以直接开始生成", data: null },
        { status: 409 },
      );
    }
    if (
      existingOrder?.status === "pending" &&
      String(existingOrder.payment_provider || "alipay") === storedPaymentProvider
    ) {
      reusableOrder = existingOrder;
    } else if (existingOrder?.status === "pending") {
      await db
        .from("alipay_orders")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", existingOrder.id)
        .eq("status", "pending");
    }
  }

  const quality = normalizeExportQuality(job.export_quality);
  const queueTier = normalizeQueueTier(job.queue_tier);
  const signupFreeAvailable = identity.userId
    ? await hasSignupFreeExport(identity.userId)
    : false;
  const quote = calculateMotionEffectPrice({
    quality,
    queueTier,
    signupFreeAvailable,
  });
  const usesSignupFree =
    job.entitlement_source === "signup_free" || quote.usesSignupFree;
  if (quote.totalCents <= 0) {
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: "当前账号可使用一次注册赠送的低清下载，无需支付",
        data: null,
      },
      { status: 409 },
    );
  }

  if (
    paymentProvider === "alipay" &&
    (!process.env.ALIPAY_APP_ID ||
      !process.env.ALIPAY_PRIVATE_KEY ||
      !process.env.ALIPAY_PUBLIC_KEY)
  ) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "支付宝配置不完整", data: null },
      { status: 500 },
    );
  }

  const subject = [
    quality === "hd" ? "教链手指光膜高清下载" : "教链手指光膜下载",
    queueTier === "priority" ? "（极速处理）" : "",
  ].join("");
  const orderData = {
    job_id: id,
    product_key: "motion_effect_export",
    export_quality: quality,
    queue_tier: queueTier,
    style_key: job.style_key || "aurora",
    bgm_key: job.bgm_key || "original",
    uses_signup_free: usesSignupFree,
    owner_claim_hash: createOrderClaimHash(
      id,
      String(job.owner_token_hash || identity.userId || ""),
    ),
  };

  const bindOrderToJob = async (orderId: string, checkoutCents: number) => {
    return db
      .from("tool_video_render_jobs")
      .update({
        status: "awaiting_payment",
        payment_status: "pending",
        payment_order_id: orderId,
        price_cents: checkoutCents,
        entitlement_source: usesSignupFree ? "signup_free" : "paid_export",
      })
      .eq("id", id)
      .in("status", ["awaiting_upload", "awaiting_payment"])
      .select("*")
      .single();
  };

  if (paymentProvider === "wechat") {
    if (!identity.userId) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "请先登录后再发起微信支付", data: null },
        { status: 401 },
      );
    }

    const { data: user, error: userError } = await db
      .from("users")
      .select("id,wechat_openid")
      .eq("id", identity.userId)
      .maybeSingle();
    if (userError || !user) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "查询微信用户信息失败", data: null },
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

    if (!String(requestBody.loginCode || "").trim()) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "获取微信登录状态失败，请重试", data: null },
        { status: 400 },
      );
    }

    const session = await exchangeWechatXPaySession(String(requestBody.loginCode));
    assertWechatOpenId(user.wechat_openid, session.openId);
    const config = getWechatXPayConfig();
    const xpayProduct = getMotionEffectXPayProduct(quote.totalCents);
    let order = reusableOrder;
    let createdNewOrder = false;

    if (
      order &&
      (Math.round(Number(order.total_amount || 0)) !== quote.totalCents ||
        String(order.order_data?.xpay_product_id || "") !== xpayProduct.productId ||
        !String(order.order_data?.xpay_out_trade_no || ""))
    ) {
      await db
        .from("alipay_orders")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("status", "pending");
      order = null;
    }

    if (!order) {
      const outTradeNo = randomUUID().replaceAll("-", "");
      const { data, error: orderError } = await db
        .from("alipay_orders")
        .insert({
          subject,
          total_amount: quote.totalCents,
          order_type: "motion_effect_export",
          order_data: {
            ...orderData,
            xpay_out_trade_no: outTradeNo,
            xpay_product_id: xpayProduct.productId,
            xpay_goods_price: quote.totalCents,
            xpay_openid: session.openId,
            xpay_env: config.env,
          },
          user_id: identity.userId,
          status: "pending",
          qr_code: "",
          payment_provider: "wechat_xpay",
        })
        .select("*")
        .single();
      order = data;
      createdNewOrder = Boolean(data);
      if (orderError || !order) {
        return NextResponse.json<ApiData<null>>(
          { success: false, message: orderError?.message || "创建微信虚拟支付订单失败", data: null },
          { status: 500 },
        );
      }

    }

    const checkoutCents = Math.round(Number(order.total_amount || quote.totalCents));
    const { params: paymentParams } = createWechatXPayParams({
      sessionKey: session.sessionKey,
      productId: String(order.order_data.xpay_product_id),
      goodsPrice: checkoutCents,
      outTradeNo: String(order.order_data.xpay_out_trade_no),
      attach: `motion:${id}`,
    });
    const { data: updatedJob, error: updateError } = await bindOrderToJob(
      String(order.id),
      checkoutCents,
    );
    if (updateError || !updatedJob) {
      if (createdNewOrder) {
        await db.from("alipay_orders").delete().eq("id", order.id);
      }
      return NextResponse.json<ApiData<null>>(
        { success: false, message: updateError?.message || "绑定微信支付订单失败", data: null },
        { status: 500 },
      );
    }

    return NextResponse.json<ApiData<MotionEffectCheckoutDto>>({
      success: true,
      message: "微信虚拟支付订单创建成功",
      data: {
        job: mapMotionEffectJob(updatedJob),
        order: {
          id: String(order.id),
          totalAmountCents: checkoutCents,
          totalAmountYuan: fenToYuan(checkoutCents),
          status: String(order.status),
        },
        paymentInfo: {
          provider: "wechat",
          paymentParams,
          description: "微信虚拟支付",
        },
      },
    });
  }

  const paymentUserId = identity.userId || getGuestPaymentUserId();
  if (!paymentUserId) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "游客支付账户未配置", data: null },
      { status: 500 },
    );
  }

  let order = reusableOrder;
  let createdNewOrder = false;
  if (!order) {
    const { data, error: orderError } = await db
      .from("alipay_orders")
      .insert({
        subject,
        total_amount: quote.totalCents,
        order_type: "motion_effect_export",
        order_data: orderData,
        user_id: paymentUserId,
        status: "pending",
        qr_code: "",
        payment_provider: "alipay",
      })
      .select("*")
      .single();
    order = data;
    createdNewOrder = Boolean(data);
    if (orderError || !order) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: orderError?.message || "创建支付订单失败", data: null },
        { status: 500 },
      );
    }
  }
  const checkoutCents = Math.round(Number(order.total_amount || quote.totalCents));

  const baseUrl = baseUrlFor(req);
  const notifyUrl =
    process.env.ALIPAY_NOTIFY_URL || `${baseUrl}/api/payment/alipay/notify`;
  const returnUrl = `${baseUrl}/toolbox/motion-effects?paymentJob=${encodeURIComponent(id)}`;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(
    String(req.headers.get("user-agent") || ""),
  );
  const alipaySdk = createAlipaySdk();
  const apiName = isMobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
  const productCode = isMobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";
  const bizParams = {
    notifyUrl,
    returnUrl,
    bizContent: {
      out_trade_no: String(order.id),
      total_amount: fenToYuan(checkoutCents).toFixed(2),
      subject,
      product_code: productCode,
      ...(isMobile ? {} : { qr_pay_mode: "0" }),
    },
  };
  const paymentResult = returnUrlOnly
    ? (alipaySdk.pageExec(apiName, "GET", bizParams) as string)
    : (alipaySdk.pageExec(apiName, bizParams) as string);
  if (!paymentResult) {
    if (createdNewOrder) {
      await db.from("alipay_orders").delete().eq("id", order.id);
    }
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "支付网关未返回有效页面", data: null },
      { status: 500 },
    );
  }

  const { data: updatedJob, error: updateError } = await bindOrderToJob(
    String(order.id),
    checkoutCents,
  );
  if (updateError || !updatedJob) {
    if (createdNewOrder) {
      await db.from("alipay_orders").delete().eq("id", order.id);
    }
    return NextResponse.json<ApiData<null>>(
      { success: false, message: updateError?.message || "绑定支付订单失败", data: null },
      { status: 500 },
    );
  }

  return NextResponse.json<ApiData<MotionEffectCheckoutDto>>({
    success: true,
    message: "支付订单创建成功",
    data: {
      job: mapMotionEffectJob(updatedJob),
      order: {
        id: String(order.id),
        totalAmountCents: checkoutCents,
        totalAmountYuan: fenToYuan(checkoutCents),
        status: String(order.status),
      },
      paymentInfo: {
        provider: "alipay",
        formHtml: returnUrlOnly ? undefined : paymentResult,
        paymentUrl: returnUrlOnly ? paymentResult : undefined,
        description: "支付宝支付",
      },
    },
  });
}
