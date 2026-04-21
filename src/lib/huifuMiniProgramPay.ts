import crypto from "crypto";

type HuifuPayload = Record<string, unknown>;

interface HuifuResponseEnvelope<T = Record<string, unknown>> {
    sign?: string;
    data?: T;
}

interface HuifuCreateMiniProgramOrderParams {
    reqDate: string;
    reqSeqId: string;
    transAmtYuan: string;
    goodsDesc: string;
    notifyUrl: string;
    openid: string;
    appId: string;
    attach?: string;
    remark?: string;
    body?: string;
    clientIp?: string;
}

function normalizeClientIp(value: string | undefined) {
    const raw = String(value || "").trim();
    if (!raw) return "127.0.0.1";
    if (raw.startsWith("::ffff:")) {
        const ipv4 = raw.slice(7).trim();
        return ipv4 || "127.0.0.1";
    }
    if (raw === "::1") return "127.0.0.1";
    return raw;
}

interface HuifuQueryOrderParams {
    orgReqDate: string;
    orgReqSeqId: string;
}

export interface HuifuPayInfo {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: "RSA";
    paySign: string;
}

export interface HuifuCreateMiniProgramOrderResult extends HuifuPayload {
    resp_code: string;
    resp_desc: string;
    req_date?: string;
    req_seq_id?: string;
    hf_seq_id?: string;
    trans_stat?: string;
    pay_info?: string;
}

export interface HuifuQueryOrderResult extends HuifuPayload {
    resp_code: string;
    resp_desc: string;
    org_req_date?: string;
    org_req_seq_id?: string;
    org_hf_seq_id?: string;
    trans_stat?: "P" | "S" | "F" | "I" | string;
    trans_amt?: string;
    pay_amt?: string;
    end_time?: string;
    remark?: string;
    wx_response?: {
        attach?: string;
        openid?: string;
        sub_openid?: string;
    } | string;
}

function normalizePem(value: string | undefined, label: string) {
    const raw = (value || "").trim();
    if (!raw) throw new Error(`${label} 缺失`);
    const unquoted =
        raw.startsWith('"') && raw.endsWith('"')
            ? raw.slice(1, -1)
            : raw.startsWith("'") && raw.endsWith("'")
              ? raw.slice(1, -1)
              : raw;
    if (unquoted.includes("BEGIN")) {
        return unquoted.replace(/\\n/g, "\n");
    }
    const normalized = unquoted.replace(/\s+/g, "");
    if (label.includes("PRIVATE")) {
        return `-----BEGIN PRIVATE KEY-----\n${normalized.match(/.{1,64}/g)?.join("\n") || normalized}\n-----END PRIVATE KEY-----`;
    }
    return `-----BEGIN PUBLIC KEY-----\n${normalized.match(/.{1,64}/g)?.join("\n") || normalized}\n-----END PUBLIC KEY-----`;
}

function getHuifuConfig() {
    const sysId = (process.env.HUIFU_SYS_ID || "").trim();
    const productId = (process.env.HUIFU_PRODUCT_ID || "").trim();
    const customerId = (process.env.HUIFU_CUSTOMER_ID || "").trim();
    const privateKey = normalizePem(process.env.HUIFU_PAY_PRIVATE_KEY, "HUIFU_PAY_PRIVATE_KEY");
    const publicKey = normalizePem(process.env.HUIFU_PUBLIC_KEY, "HUIFU_PUBLIC_KEY");
    const baseUrl = (process.env.HUIFU_API_BASE_URL || "https://api.huifu.com").trim().replace(/\/+$/, "");

    if (!sysId) throw new Error("HUIFU_SYS_ID 缺失");
    if (!productId) throw new Error("HUIFU_PRODUCT_ID 缺失");
    if (!customerId) throw new Error("HUIFU_CUSTOMER_ID 缺失");

    return {
        sysId,
        productId,
        customerId,
        privateKey,
        publicKey,
        baseUrl,
    };
}

function sortFirstLevel(data: HuifuPayload) {
    const result: HuifuPayload = {};
    for (const key of Object.keys(data).sort()) {
        const value = data[key];
        if (value !== undefined && value !== null) {
            result[key] = value;
        }
    }
    return result;
}

function stringifyForSign(data: HuifuPayload, sortKeys: boolean) {
    return JSON.stringify(sortKeys ? sortFirstLevel(data) : data);
}

export function signHuifuData(data: HuifuPayload) {
    const { privateKey } = getHuifuConfig();
    const content = stringifyForSign(data, true);
    return crypto.createSign("RSA-SHA256").update(content, "utf8").sign(privateKey, "base64");
}

export function verifyHuifuDataSignature(
    data: HuifuPayload,
    sign: string,
    { sortKeys }: { sortKeys: boolean },
) {
    const { publicKey } = getHuifuConfig();
    const content = stringifyForSign(data, sortKeys);
    return crypto.createVerify("RSA-SHA256").update(content, "utf8").verify(publicKey, sign, "base64");
}

async function huifuPost<T extends HuifuPayload>(
    path: string,
    data: HuifuPayload,
): Promise<T> {
    const { baseUrl, sysId, productId } = getHuifuConfig();
    console.info("[Huifu] request payload:", {
        url: `${baseUrl}${path}`,
        sys_id: sysId,
        product_id: productId,
        data,
    });
    const payload = {
        sys_id: sysId,
        product_id: productId,
        data,
        sign: signHuifuData(data),
    };

    const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as HuifuResponseEnvelope<T>) : {};

    if (!response.ok) {
        console.error("[Huifu] request failed:", {
            url: `${baseUrl}${path}`,
            status: response.status,
            statusText: response.statusText,
            sysId,
            productId,
            reqSeqId: data.req_seq_id,
            huifuId: data.huifu_id,
            tradeType: data.trade_type,
            body: text || null,
        });
        const respDesc =
            parsed?.data && typeof parsed.data.resp_desc === "string"
                ? parsed.data.resp_desc
                : `汇付请求失败: ${response.status}${text ? ` ${text}` : ""}`;
        throw new Error(respDesc);
    }

    if (!parsed?.data) {
        throw new Error("汇付响应缺少 data");
    }

    if (!parsed?.sign) {
        throw new Error("汇付响应缺少 sign");
    }

    const valid = verifyHuifuDataSignature(parsed.data as HuifuPayload, parsed.sign, { sortKeys: true });
    if (!valid) {
        console.error("[Huifu] response signature verify failed:", {
            url: `${baseUrl}${path}`,
            sysId,
            productId,
            reqSeqId: data.req_seq_id,
            huifuId: data.huifu_id,
            body: parsed.data,
        });
        throw new Error("汇付响应验签失败");
    }

    return parsed.data;
}

export function parseHuifuPayInfo(payInfo: string | HuifuPayInfo | undefined | null): HuifuPayInfo {
    const value = typeof payInfo === "string" ? JSON.parse(payInfo) : payInfo;
    if (!value || typeof value !== "object") {
        throw new Error("汇付支付返回缺少 pay_info");
    }
    const appId = String((value as any).appId || (value as any).appid || "").trim();
    const timeStamp = String((value as any).timeStamp || "").trim();
    const nonceStr = String((value as any).nonceStr || "").trim();
    const packageValue = String((value as any).package || "").trim();
    const signType = String((value as any).signType || "RSA").trim() as "RSA";
    const paySign = String((value as any).paySign || "").trim();

    if (!appId || !timeStamp || !nonceStr || !packageValue || !paySign) {
        throw new Error("汇付支付参数不完整");
    }

    return {
        appId,
        timeStamp,
        nonceStr,
        package: packageValue,
        signType,
        paySign,
    };
}

export function formatHuifuReqDate(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${partMap.year}${partMap.month}${partMap.day}`;
}

export async function createHuifuMiniProgramOrder(params: HuifuCreateMiniProgramOrderParams) {
    const { customerId } = getHuifuConfig();
    return huifuPost<HuifuCreateMiniProgramOrderResult>("/v3/trade/payment/jspay", {
        req_date: params.reqDate,
        req_seq_id: params.reqSeqId,
        huifu_id: customerId,
        trade_type: "T_MINIAPP",
        trans_amt: params.transAmtYuan,
        goods_desc: params.goodsDesc,
        notify_url: params.notifyUrl,
        wx_data: JSON.stringify({
            openid: params.openid,
            sub_openid: params.openid,
            sub_appid: params.appId,
        }),
        remark: params.remark,
    });
}

export async function queryHuifuMiniProgramOrder(params: HuifuQueryOrderParams) {
    const { customerId } = getHuifuConfig();
    return huifuPost<HuifuQueryOrderResult>("/v3/trade/payment/scanpay/query", {
        huifu_id: customerId,
        org_req_date: params.orgReqDate,
        org_req_seq_id: params.orgReqSeqId,
    });
}

export function parseHuifuNotify(rawBody: string) {
    const parsed = JSON.parse(rawBody) as HuifuResponseEnvelope<HuifuPayload>;
    if (!parsed?.data || !parsed?.sign) {
        throw new Error("汇付异步通知缺少 data/sign");
    }
    const valid = verifyHuifuDataSignature(parsed.data, parsed.sign, { sortKeys: false });
    if (!valid) {
        throw new Error("汇付异步通知验签失败");
    }
    return parsed.data;
}

export function parseHuifuNotifyContent(content: string, sign: string) {
    const parsed = JSON.parse(content) as HuifuPayload;
    const valid = verifyHuifuDataSignature(parsed, sign, { sortKeys: false });
    if (!valid) {
        throw new Error("汇付异步通知验签失败");
    }
    return parsed;
}
