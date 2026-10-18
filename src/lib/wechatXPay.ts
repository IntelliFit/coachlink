import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface WechatXPayConfig {
    offerId: string;
    appKey: string;
    env: 0 | 1;
    messageToken: string;
    appId: string;
    appSecret: string;
}

export interface WechatXPayParams {
    signData: string;
    paySig: string;
    signature: string;
    mode: "short_series_goods";
}

export interface WechatXPaySignData {
    offerId: string;
    buyQuantity: number;
    env: 0 | 1;
    currencyType: "CNY";
    productId: string;
    goodsPrice: number;
    outTradeNo: string;
    attach: string;
}

type WechatSession = { openId: string; sessionKey: string };

let accessTokenCache: { token: string; expiresAt: number } | null = null;

function requiredEnv(name: string) {
    const value = String(process.env[name] || "").trim();
    if (!value) throw new Error(`缺少小程序虚拟支付配置：${name}`);
    return value;
}

export function getWechatXPayConfig(options: { requireMessageToken?: boolean } = {}): WechatXPayConfig {
    const messageToken = String(process.env.WECHAT_XPAY_MESSAGE_TOKEN || "").trim();
    if (options.requireMessageToken && !messageToken) {
        throw new Error("缺少小程序虚拟支付配置：WECHAT_XPAY_MESSAGE_TOKEN");
    }
    return {
        offerId: requiredEnv("WECHAT_XPAY_OFFER_ID"),
        appKey: requiredEnv("WECHAT_XPAY_APP_KEY"),
        env: String(process.env.WECHAT_XPAY_SANDBOX || "").toLowerCase() === "true" ? 1 : 0,
        messageToken,
        appId: requiredEnv("WECHAT_MINIAPP_APPID"),
        appSecret: requiredEnv("WECHAT_MINIAPP_SECRET"),
    };
}

export function hmacSha256Hex(key: string, value: string) {
    return createHmac("sha256", key).update(value).digest("hex");
}

export async function exchangeWechatXPaySession(loginCode: string): Promise<WechatSession> {
    const code = String(loginCode || "").trim();
    if (!code) throw new Error("请刷新小程序登录状态后重试");
    const config = getWechatXPayConfig();
    const query = new URLSearchParams({
        appid: config.appId,
        secret: config.appSecret,
        js_code: code,
        grant_type: "authorization_code",
    });
    const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`, {
        cache: "no-store",
    });
    const result = await response.json() as {
        openid?: string;
        session_key?: string;
        errcode?: number;
        errmsg?: string;
    };
    const openId = String(result.openid || "").trim();
    const sessionKey = String(result.session_key || "").trim();
    if (!response.ok || Number(result.errcode || 0) !== 0 || !openId || !sessionKey) {
        throw new Error(result.errmsg || "获取虚拟支付登录态失败，请重试");
    }
    return { openId, sessionKey };
}

export function assertWechatOpenId(expected: unknown, actual: unknown) {
    const left = Buffer.from(String(expected || "").trim());
    const right = Buffer.from(String(actual || "").trim());
    if (!left.length || left.length !== right.length || !timingSafeEqual(left, right)) {
        throw new Error("支付登录用户与当前账号不一致，请重新登录后重试");
    }
}

export function createWechatXPayParams(input: {
    sessionKey: string;
    productId: string;
    goodsPrice: number;
    outTradeNo: string;
    attach: string;
}): { params: WechatXPayParams; signData: WechatXPaySignData } {
    const config = getWechatXPayConfig();
    const goodsPrice = Math.round(Number(input.goodsPrice));
    if (!Number.isSafeInteger(goodsPrice) || goodsPrice <= 0) {
        throw new Error("虚拟支付商品价格无效");
    }
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(input.productId)) {
        throw new Error("虚拟支付商品 ID 无效");
    }
    if (!/^[A-Za-z0-9_-]{8,32}$/.test(input.outTradeNo)) {
        throw new Error("虚拟支付订单号无效");
    }
    const signData: WechatXPaySignData = {
        offerId: config.offerId,
        buyQuantity: 1,
        env: config.env,
        currencyType: "CNY",
        productId: input.productId,
        goodsPrice,
        outTradeNo: input.outTradeNo,
        attach: String(input.attach || "").slice(0, 255),
    };
    const serialized = JSON.stringify(signData);
    return {
        signData,
        params: {
            signData: serialized,
            paySig: hmacSha256Hex(config.appKey, `requestVirtualPayment&${serialized}`),
            signature: hmacSha256Hex(input.sessionKey, serialized),
            mode: "short_series_goods",
        },
    };
}

export function verifyWechatXPayCallbackSignature(input: {
    timestamp: string;
    nonce: string;
    signature: string;
}) {
    // URL verification is configured before payment credentials. Only the
    // message token is needed to authenticate WeChat's callback signature.
    const messageToken = requiredEnv("WECHAT_XPAY_MESSAGE_TOKEN");
    const expected = createHash("sha1")
        .update([messageToken, input.timestamp, input.nonce].sort().join(""))
        .digest("hex");
    const actual = String(input.signature || "").trim().toLowerCase();
    const left = Buffer.from(expected);
    const right = Buffer.from(actual);
    return left.length === right.length && timingSafeEqual(left, right);
}

async function getWechatAccessToken() {
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
        return accessTokenCache.token;
    }
    const config = getWechatXPayConfig();
    // Concurrent main/dev consumers must not invalidate each other's token.
    const response = await fetch("https://api.weixin.qq.com/cgi-bin/stable_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "client_credential",
            appid: config.appId,
            secret: config.appSecret,
            force_refresh: false,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
    });
    const result = await response.json() as {
        access_token?: string;
        expires_in?: number;
        errcode?: number;
        errmsg?: string;
    };
    const token = String(result.access_token || "").trim();
    if (!response.ok || !token) throw new Error(result.errmsg || "获取微信接口凭证失败");
    accessTokenCache = {
        token,
        expiresAt: Date.now() + Math.max(300, Number(result.expires_in || 7200)) * 1000,
    };
    return token;
}

export interface WechatXPayOrderQueryResult {
    errcode: number;
    errmsg?: string;
    order?: {
        order_id?: string;
        status?: number;
        order_fee?: number;
        paid_fee?: number;
        refund_fee?: number;
        paid_time?: number;
        wx_order_id?: string;
        wxpay_order_id?: string;
        left_fee?: number;
        sett_state?: number;
        platform_fee_fen?: number;
    };
}

export async function queryWechatXPayOrder(input: { openId: string; outTradeNo: string }) {
    const config = getWechatXPayConfig();
    const uri = "/xpay/query_order";
    const body = JSON.stringify({
        openid: input.openId,
        env: config.env,
        order_id: input.outTradeNo,
    });
    const accessToken = await getWechatAccessToken();
    const paySig = hmacSha256Hex(config.appKey, `${uri}&${body}`);
    const url = `https://api.weixin.qq.com${uri}?access_token=${encodeURIComponent(accessToken)}&pay_sig=${paySig}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
    });
    const result = await response.json() as WechatXPayOrderQueryResult;
    if (!response.ok || Number(result.errcode || 0) !== 0) {
        throw new Error(result.errmsg || "查询虚拟支付订单失败");
    }
    return result.order || null;
}

export async function notifyWechatXPayProvidedGoods(outTradeNo: string) {
    const config = getWechatXPayConfig();
    const uri = '/xpay/notify_provide_goods';
    const body = JSON.stringify({ env: config.env, order_id: outTradeNo });
    const token = await getWechatAccessToken();
    const paySig = hmacSha256Hex(config.appKey, `${uri}&${body}`);
    const response = await fetch(`https://api.weixin.qq.com${uri}?access_token=${encodeURIComponent(token)}&pay_sig=${paySig}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, cache: 'no-store',
        signal: AbortSignal.timeout(15000),
    });
    const result = await response.json() as { errcode?: number; errmsg?: string };
    if (!response.ok || result.errcode !== 0) throw new Error(result.errmsg || '微信发货确认失败');
}
