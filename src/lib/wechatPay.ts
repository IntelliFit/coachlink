import crypto from "crypto";

const WECHAT_PAY_BASE_URL = "https://api.mch.weixin.qq.com";

type HttpMethod = "GET" | "POST";

interface WechatPayRequestOptions {
    method: HttpMethod;
    path: string;
    body?: string;
}

interface WechatPayFetchOptions extends WechatPayRequestOptions {
    skipResponseSignatureVerification?: boolean;
}

interface WechatPayCreateOrderParams {
    appid: string;
    mchid: string;
    description: string;
    out_trade_no: string;
    notify_url: string;
    amount: {
        total: number;
        currency?: string;
    };
    payer: {
        openid: string;
    };
}

export interface WechatMiniProgramPaymentParams {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: "RSA";
    paySign: string;
}

export interface WechatPayQueryOrderResult {
    tradeState: string | null;
    tradeStateDesc: string | null;
    transactionId: string | null;
    outTradeNo: string | null;
    payerOpenid: string | null;
    successTime: string | null;
    amountTotal: number | null;
    raw: Record<string, any>;
}

export interface WechatPayNotificationResource {
    id?: string;
    create_time?: string;
    event_type?: string;
    resource_type?: string;
    summary?: string;
    resource?: {
        original_type?: string;
        algorithm?: string;
        ciphertext?: string;
        associated_data?: string;
        nonce?: string;
    };
}

function normalizePem(value: string | undefined, label?: string): string {
    const raw = (value || "").trim();
    if (!raw) {
        throw new Error(`${label || "微信支付配置"}缺失`);
    }

    const unquoted =
        raw.startsWith('"') && raw.endsWith('"')
            ? raw.slice(1, -1)
            : raw.startsWith("'") && raw.endsWith("'")
              ? raw.slice(1, -1)
              : raw;

    return unquoted.replace(/\\n/g, "\n");
}

function getWechatPayConfig() {
    const mchid = (process.env.WECHAT_PAY_MCHID || "").trim();
    const serialNo = (process.env.WECHAT_PAY_SERIAL_NO || "").trim();
    const apiV3Key = (process.env.WECHAT_PAY_API_V3_KEY || "").trim();
    const privateKey = normalizePem(process.env.WECHAT_PAY_PRIVATE_KEY, "WECHAT_PAY_PRIVATE_KEY");
    const publicKey = normalizePem(process.env.WECHAT_PAY_PUBLIC_KEY, "WECHAT_PAY_PUBLIC_KEY");

    if (!mchid) {
        throw new Error("WECHAT_PAY_MCHID 缺失");
    }
    if (!serialNo) {
        throw new Error("WECHAT_PAY_SERIAL_NO 缺失");
    }
    if (!apiV3Key) {
        throw new Error("WECHAT_PAY_API_V3_KEY 缺失");
    }

    return {
        mchid,
        serialNo,
        apiV3Key,
        privateKey,
        publicKey,
    };
}

function buildWechatPayConfigDebugSummary() {
    const config = getWechatPayConfig();
    const privateKeyFingerprint = crypto
        .createHash("sha256")
        .update(config.privateKey)
        .digest("hex")
        .slice(0, 12);

    return {
        mchid: config.mchid,
        serialNo: config.serialNo,
        privateKeyFingerprint,
        privateKeyHasBegin: config.privateKey.includes("-----BEGIN PRIVATE KEY-----"),
        privateKeyHasEnd: config.privateKey.includes("-----END PRIVATE KEY-----"),
        privateKeyLength: config.privateKey.length,
        apiV3KeyLength: config.apiV3Key.length,
        publicKeyHasBegin: config.publicKey.includes("-----BEGIN PUBLIC KEY-----"),
        publicKeyHasEnd: config.publicKey.includes("-----END PUBLIC KEY-----"),
    };
}

function generateNonce(length = 32) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

function buildAuthorizationHeader({ method, path, body = "" }: WechatPayRequestOptions) {
    const { mchid, serialNo, privateKey } = getWechatPayConfig();
    const nonceStr = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`;
    const signature = crypto
        .createSign("RSA-SHA256")
        .update(message)
        .sign(privateKey, "base64");

    return {
        authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`,
        nonceStr,
        timestamp,
    };
}

function verifyWechatpaySignature(options: {
    timestamp: string;
    nonce: string;
    signature: string;
    body: string;
}) {
    const { publicKey } = getWechatPayConfig();
    const message = `${options.timestamp}\n${options.nonce}\n${options.body}\n`;
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(message);
    return verifier.verify(publicKey, options.signature, "base64");
}

function decryptWechatPayResource(resource: NonNullable<WechatPayNotificationResource["resource"]>) {
    const { apiV3Key } = getWechatPayConfig();
    const ciphertext = Buffer.from(resource.ciphertext || "", "base64");
    const nonce = Buffer.from(resource.nonce || "", "utf8");
    const associatedData = Buffer.from(resource.associated_data || "", "utf8");

    const authTag = ciphertext.subarray(ciphertext.length - 16);
    const data = ciphertext.subarray(0, ciphertext.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(apiV3Key, "utf8"), nonce);

    if (associatedData.length > 0) {
        decipher.setAAD(associatedData);
    }
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
}

async function wechatPayFetch<T = Record<string, any>>(options: WechatPayFetchOptions): Promise<T> {
    const body = options.body || "";
    const { authorization } = buildAuthorizationHeader({
        method: options.method,
        path: options.path,
        body,
    });

    const response = await fetch(`${WECHAT_PAY_BASE_URL}${options.path}`, {
        method: options.method,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: authorization,
            "User-Agent": "CoachLink-WechatPay/1.0",
        },
        body: options.method === "GET" ? undefined : body,
    });

    const rawBody = await response.text();

    if (!options.skipResponseSignatureVerification) {
        const signature = response.headers.get("Wechatpay-Signature");
        const timestamp = response.headers.get("Wechatpay-Timestamp");
        const nonce = response.headers.get("Wechatpay-Nonce");

        if (signature && timestamp && nonce) {
            const valid = verifyWechatpaySignature({
                signature,
                timestamp,
                nonce,
                body: rawBody,
            });

            if (!valid) {
                throw new Error("微信支付响应验签失败");
            }
        }
    }

    const parsed = rawBody ? JSON.parse(rawBody) : {};
    if (!response.ok) {
        console.error("[Wechat Pay HTTP Error]", {
            method: options.method,
            path: options.path,
            status: response.status,
            statusText: response.statusText,
            configDebug: buildWechatPayConfigDebugSummary(),
            responseBody: parsed,
        });
        const errorMessage =
            parsed?.message ||
            parsed?.detail ||
            parsed?.errmsg ||
            `微信支付请求失败: ${response.status}`;
        throw new Error(`[HTTP ${response.status}] ${errorMessage}`);
    }

    return parsed as T;
}

export function getWechatMiniAppConfig() {
    const appId = (process.env.WECHAT_MINIAPP_APPID || "").trim();
    if (!appId) {
        throw new Error("WECHAT_MINIAPP_APPID 缺失");
    }
    return { appId };
}

export function getWechatPayNotifyUrl() {
    const notifyUrl = (process.env.WECHAT_PAY_NOTIFY_URL || "").trim();
    if (!notifyUrl) {
        throw new Error("WECHAT_PAY_NOTIFY_URL 缺失");
    }
    return notifyUrl;
}

export function generateOutTradeNo(prefix = "CLT") {
    const timestamp = Date.now().toString();
    const randomPart = crypto.randomBytes(4).toString("hex");
    return `${prefix}${timestamp}${randomPart}`.slice(0, 32);
}

export async function createMiniProgramTestOrder(params: Omit<WechatPayCreateOrderParams, "appid" | "mchid" | "notify_url"> & {
    description: string;
    out_trade_no: string;
}) {
    const { appId } = getWechatMiniAppConfig();
    const { mchid } = getWechatPayConfig();
    const notify_url = getWechatPayNotifyUrl();

    const response = await wechatPayFetch<{ prepay_id: string }>({
        method: "POST",
        path: "/v3/pay/transactions/jsapi",
        body: JSON.stringify({
            appid: appId,
            mchid,
            description: params.description,
            out_trade_no: params.out_trade_no,
            notify_url,
            amount: {
                total: params.amount.total,
                currency: params.amount.currency || "CNY",
            },
            payer: params.payer,
        }),
    });

    if (!response.prepay_id) {
        throw new Error("微信支付未返回 prepay_id");
    }

    return response;
}

export function buildMiniProgramPaymentParams(prepayId: string): WechatMiniProgramPaymentParams {
    const { appId } = getWechatMiniAppConfig();
    const { privateKey } = getWechatPayConfig();
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = generateNonce();
    const packageValue = `prepay_id=${prepayId}`;
    const signType: "RSA" = "RSA";
    const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`;
    const paySign = crypto.createSign("RSA-SHA256").update(message).sign(privateKey, "base64");

    return {
        appId,
        timeStamp,
        nonceStr,
        package: packageValue,
        signType,
        paySign,
    };
}

export async function queryOrderByOutTradeNo(outTradeNo: string): Promise<WechatPayQueryOrderResult> {
    const { mchid } = getWechatPayConfig();
    const encodedOrderNo = encodeURIComponent(outTradeNo);
    const encodedMchid = encodeURIComponent(mchid);
    const path = `/v3/pay/transactions/out-trade-no/${encodedOrderNo}?mchid=${encodedMchid}`;

    const response = await wechatPayFetch<Record<string, any>>({
        method: "GET",
        path,
    });

    return {
        tradeState: response.trade_state || null,
        tradeStateDesc: response.trade_state_desc || null,
        transactionId: response.transaction_id || null,
        outTradeNo: response.out_trade_no || null,
        payerOpenid: response?.payer?.openid || null,
        successTime: response.success_time || null,
        amountTotal: typeof response?.amount?.total === "number" ? response.amount.total : null,
        raw: response,
    };
}

export function verifyCallbackSignature(headers: Headers, body: string) {
    const signature = headers.get("Wechatpay-Signature");
    const timestamp = headers.get("Wechatpay-Timestamp");
    const nonce = headers.get("Wechatpay-Nonce");

    if (!signature || !timestamp || !nonce) {
        throw new Error("微信支付回调请求头不完整");
    }

    const valid = verifyWechatpaySignature({
        signature,
        timestamp,
        nonce,
        body,
    });

    if (!valid) {
        throw new Error("微信支付回调验签失败");
    }
}

export function decryptCallbackBody(payload: WechatPayNotificationResource) {
    if (!payload.resource) {
        throw new Error("微信支付回调缺少 resource");
    }

    return decryptWechatPayResource(payload.resource);
}
