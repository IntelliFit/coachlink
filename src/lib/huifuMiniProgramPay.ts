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
    tradeType?: string;            // "T_MINIAPP" (默认) | "A_JSAPI" | "A_NATIVE"
    alipayData?: { subject: string; body?: string; buyer_id?: string };
    acctSplitBunch?: string;       // JSON，实时分账时传入（新方案不再使用）
    delayAcctFlag?: string;        // "Y" | "N"，默认 "N"
    feeFlag?: number;              // 1=外扣, 2=内扣，默认 2
    acctId?: string;               // 指定收款账户号（现金户），不填默认基本户
}

export interface SplitReceiver {
    huifuId: string;
    percentageDiv: string; // 如 "80.00"
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
    const tradeType = params.tradeType || "T_MINIAPP";
    const isAlipay = tradeType === "A_JSAPI" || tradeType === "A_NATIVE";

    const payload: HuifuPayload = {
        req_date: params.reqDate,
        req_seq_id: params.reqSeqId,
        huifu_id: customerId,
        trade_type: tradeType,
        trans_amt: params.transAmtYuan,
        goods_desc: params.goodsDesc,
        notify_url: params.notifyUrl,
        delay_acct_flag: params.delayAcctFlag || "N",
        fee_flag: params.feeFlag ?? 2,
        term_div_coupon_type: 1, // 优惠券按比例分摊
        remark: params.remark,
    };

    // 渠道专属参数
    if (isAlipay && params.alipayData) {
        payload.alipay_data = JSON.stringify({
            subject: params.alipayData.subject,
            body: params.alipayData.body || params.alipayData.subject,
            buyer_id: params.alipayData.buyer_id || "",
        });
    } else {
        payload.wx_data = JSON.stringify({
            openid: params.openid,
            sub_openid: params.openid,
            sub_appid: params.appId,
        });
    }

    // 指定收款账户（现金户不自动结算，基本户默认次日结算）
    if (params.acctId) {
        payload.acct_id = params.acctId;
    }

    // 实时分账（已弃用，改用余额支付分账方案）
    if (params.acctSplitBunch) {
        payload.acct_split_bunch = params.acctSplitBunch;
    }

    // risk_check_data
    payload.risk_check_data = JSON.stringify({
        transfer_type: "03",
        sub_product: "1",
        ip_addr: normalizeClientIp(params.clientIp),
    });

    return huifuPost<HuifuCreateMiniProgramOrderResult>("/v3/trade/payment/jspay", payload);
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

// ── 分账工具 ──

export function buildAcctSplitBunch(receivers: SplitReceiver[]): string {
    const total = receivers.reduce((sum, r) => sum + parseFloat(r.percentageDiv), 0);
    if (Math.abs(total - 100) > 0.001) {
        throw new Error(`分账百分比总和必须为 100.00%，当前为 ${total}%`);
    }
    return JSON.stringify({
        acct_infos: receivers.map(r => ({
            huifu_id: r.huifuId,
            percentage_div: r.percentageDiv,
        })),
        percentage_flag: "Y",
    });
}

export interface SplitActual {
    huifuId: string;
    divAmtYuan: string;
    divAmtFen: number;
}

/** 从回调 acct_split_bunch 解析实际分账金额（以汇付为准，不自己算） */
export function parseAcctSplitBunch(raw: string | Record<string, unknown> | undefined | null): SplitActual[] {
    if (!raw) return [];
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    const infos = Array.isArray((data as any)?.acct_infos) ? (data as any).acct_infos : [];
    return infos.map((info: any) => ({
        huifuId: String(info.huifu_id || info.in_huifu_id || ""),
        divAmtYuan: String(info.div_amt || "0"),
        divAmtFen: Math.round(parseFloat(String(info.div_amt || "0")) * 100),
    }));
}

// ── 教练开户 ──

export function generateReqSeqId(): string {
    const date = formatHuifuReqDate();
    const rand = Math.random().toString(36).slice(2, 10);
    return `${date}_${rand}`;
}

/** 身份证照片上传（multipart/form-data，不加签） */
export async function uploadHuifuFile(params: {
    fileContent: string; // base64
    fileType: string;    // F04=人像面, F05=国徽面
}): Promise<{ file_id: string }> {
    const { sysId, productId, baseUrl } = getHuifuConfig();

    const reqDate = formatHuifuReqDate();
    const reqSeqId = generateReqSeqId();

    // SDK 的 requestBasePay 会把业务参数包在 data JSON 里，和 JSON 接口一致：
    // sys_id + product_id + data(JSON) + file(multipart)
    const dataJson = JSON.stringify({
        req_date: reqDate,
        req_seq_id: reqSeqId,
        file_type: params.fileType,
    });

    const formData = new FormData();
    formData.append("sys_id", sysId);
    formData.append("product_id", productId);
    formData.append("data", dataJson);

    const fileBuffer = Buffer.from(params.fileContent, "base64");
    const fileBlob = new Blob([fileBuffer], { type: "image/jpeg" });
    formData.append("file", fileBlob, "image.jpg");

    console.log("[Huifu] uploadHuifuFile request:", {
        url: `${baseUrl}/v2/supplementary/picture`,
        sys_id: sysId,
        product_id: productId,
        data: dataJson,
        file_size: fileBuffer.length,
    });

    const response = await fetch(`${baseUrl}/v2/supplementary/picture`, {
        method: "POST",
        body: formData,
    });

    const text = await response.text();
    console.log("[Huifu] uploadHuifuFile response:", text);

    if (!response.ok) {
        throw new Error(`汇付图片上传失败: ${response.status} ${text}`);
    }

    const result = text ? JSON.parse(text) : {};
    const fileId = (result as any).file_id || (result as any).data?.file_id;
    if (!fileId) {
        throw new Error(`汇付图片上传未返回 file_id，实际响应: ${text}`);
    }

    return { file_id: fileId };
}

interface HuifuCreateIndividualUserResult {
    huifu_id: string;
}

/** 个人用户开户 */
export async function createHuifuIndividualUser(params: {
    name: string;
    certType: string;
    certNo: string;
    certValidityType: string;
    certBeginDate: string;
    certEndDate?: string;
    mobileNo: string;
    fileList?: string;
}): Promise<{ huifu_id: string }> {
    const { customerId } = getHuifuConfig();
    const payload: HuifuPayload = {
        req_date: formatHuifuReqDate(),
        req_seq_id: generateReqSeqId(),
        huifu_id: customerId,
        name: params.name,
        cert_type: params.certType,
        cert_no: params.certNo,
        cert_validity_type: params.certValidityType,
        cert_begin_date: params.certBeginDate,
        mobile_no: params.mobileNo,
    };
    if (params.certEndDate) {
        payload.cert_end_date = params.certEndDate;
    }
    if (params.fileList) {
        payload.file_list = params.fileList;
    }
    const result = await huifuPost<HuifuCreateIndividualUserResult>("/v2/user/basicdata/indv", payload);
    console.log("[Huifu] createHuifuIndividualUser response:", JSON.stringify(result));
    // 汇付个人开户返回的字段可能是 huifu_id 或 user_id
    const huifuId = (result as any).huifu_id || (result as any).user_id;
    if (!huifuId) {
        throw new Error(`汇付开户未返回 huifu_id，实际响应: ${JSON.stringify(result)}`);
    }
    return { huifu_id: huifuId };
}

/** 用户业务入驻（配置结算卡 — 对私必填 card_info + 结算配置）。
 *  返回绑卡后汇付下发的 token_no，用于后续提现。 */
export async function openHuifuUserBusiness(params: {
    huifuId: string;
    cardType?: string;
    cardNo: string;
    cardName: string;
    bankCode: string;
    branchCode: string;
    branchName: string;
    provId: string;
    areaId: string;
    certType: string;
    certNo: string;
    certValidityType: string;
    certBeginDate: string;
    certEndDate?: string;
    mobileNo: string;
}): Promise<{ tokenNo: string; applyNo?: string; respBusiness?: unknown }> {
    const { customerId } = getHuifuConfig();
    const cardInfo: HuifuPayload = {
        // Personal Huifu users must use private settlement cards; "0" is rejected
        // by Huifu with "个人只能是对私结算类型[cardType]".
        card_type: params.cardType || "1",
        card_no: params.cardNo,
        card_name: params.cardName,
        bank_code: params.bankCode,
        branch_code: params.branchCode,
        branch_name: params.branchName,
        prov_id: params.provId,
        area_id: params.areaId,
        cert_type: params.certType,
        cert_no: params.certNo,
        cert_validity_type: params.certValidityType,
        cert_begin_date: params.certBeginDate,
        mp: params.mobileNo,
    };
    if (params.certEndDate) {
        cardInfo.cert_end_date = params.certEndDate;
    }

    const result = await huifuPost<{
        resp_code?: string;
        resp_desc?: string;
        token_no?: string;
        apply_no?: string;
        resp_business?: unknown;
    }>("/v2/user/busi/open", {
        req_date: formatHuifuReqDate(),
        req_seq_id: generateReqSeqId(),
        huifu_id: params.huifuId,
        upper_huifu_id: customerId,
        card_info: JSON.stringify(cardInfo),
        cash_config: JSON.stringify([{
            cash_type: String(process.env.HUIFU_COACH_CASH_TYPE || "D1").trim(),
            fix_amt: String(process.env.HUIFU_COACH_CASH_FIX_AMT || "0.03").trim(),
            fee_rate: String(process.env.HUIFU_COACH_CASH_FEE_RATE || "2").trim(),
            out_fee_flag: "",
            out_fee_huifu_id: "",
            out_fee_acct_type: "",
        }]),
    });
    if (result?.resp_code && result.resp_code !== "00000000") {
        throw new Error(result.resp_desc || `汇付业务入驻失败: ${result.resp_code}`);
    }

    if (!result?.token_no) {
        throw new Error(
            result?.apply_no
                ? `汇付业务入驻审核中，申请单号：${result.apply_no}`
                : "汇付业务入驻未返回取现卡 token_no，请在汇付商户平台确认用户业务入驻是否成功",
        );
    }

    return {
        tokenNo: result.token_no,
        applyNo: result.apply_no,
        respBusiness: result.resp_business,
    };
}

// ── 账户查询 ──
export interface HuifuAccountInfo {
    acct_id: string;
    acct_name: string;
    acct_type: string;
    balance: string;
    huifu_id: string;
}

/** 查询用户子账户列表 */
export async function queryHuifuUserAccounts(huifuId: string): Promise<HuifuAccountInfo[]> {
    const result = await huifuPost<{ acct_infos?: HuifuAccountInfo[] }>("/v2/acct/query", {
        req_date: formatHuifuReqDate(),
        req_seq_id: generateReqSeqId(),
        huifu_id: huifuId,
    });
    return (result as any).acct_infos || (result as any).acct_list || [];
}

// ── 余额支付分账 ──

export interface BalanceSplitReceiver {
    huifuId: string;
    divAmt: string; // 单位元，如 "0.80"
}

export interface BalancePaymentResult extends HuifuPayload {
    resp_code: string;
    resp_desc: string;
    trans_stat?: string;
    hf_seq_id?: string;
    out_huifu_id?: string;
    ord_amt?: string;
    acct_split_bunch?: string;
    acct_payment_split_bunch?: string;
}

export interface BalancePaymentQueryResult extends HuifuPayload {
    resp_code: string;
    resp_desc: string;
    trans_stat?: string;
    hf_seq_id?: string;
    org_req_date?: string;
    org_req_seq_id?: string;
    ord_amt?: string;
    acct_split_bunch?: string;
    acct_payment_split_bunch?: string;
}

/** 余额支付：从平台现金户转账到教练/平台账户 */
export async function transferByBalancePayment(params: {
    reqDate: string;
    reqSeqId: string;
    transAmtYuan: string;
    receivers: BalanceSplitReceiver[];
    remark?: string;
    outAcctId?: string; // 出款账户号，默认用现金户 F22836659
    outHuifuId?: string; // 出款方商户号，默认平台
}): Promise<BalancePaymentResult> {
    const { customerId } = getHuifuConfig();

    // 校验分账金额总和 = 订单金额
    const totalDiv = params.receivers.reduce((sum, r) => sum + parseFloat(r.divAmt), 0);
    if (Math.abs(totalDiv - parseFloat(params.transAmtYuan)) > 0.01) {
        throw new Error(`分账金额总和(${totalDiv})必须等于订单金额(${params.transAmtYuan})`);
    }

    const payload: HuifuPayload = {
        req_date: params.reqDate,
        req_seq_id: params.reqSeqId,
        out_huifu_id: params.outHuifuId || customerId,
        ord_amt: params.transAmtYuan,
        acct_split_bunch: JSON.stringify({
            acct_infos: params.receivers.map(r => ({
                huifu_id: r.huifuId,
                div_amt: r.divAmt,
            })),
        }),
        risk_check_data: JSON.stringify({
            transfer_type: "04",
            sub_product: "1",
        }),
        remark: params.remark ?? "教练订阅分账",
    };

    // 指定出款账户（现金户，不自动结算）
    if (params.outAcctId || process.env.HUIFU_CASH_ACCT_ID) {
        payload.out_acct_id = params.outAcctId || process.env.HUIFU_CASH_ACCT_ID;
    }

    return huifuPost<BalancePaymentResult>("/v2/trade/acctpayment/pay", payload);
}

/** 查询余额支付分账结果。用于处理已经发起请求但本地停在 processing 的分账记录。 */
export async function queryBalancePayment(params: {
    orgReqDate: string;
    orgReqSeqId: string;
    huifuId?: string;
}): Promise<BalancePaymentQueryResult> {
    const { customerId } = getHuifuConfig();
    return huifuPost<BalancePaymentQueryResult>("/v2/trade/acctpayment/pay/query", {
        req_date: formatHuifuReqDate(),
        req_seq_id: generateReqSeqId(),
        huifu_id: params.huifuId || customerId,
        org_req_date: params.orgReqDate,
        org_req_seq_id: params.orgReqSeqId,
    });
}

// ── 取现 ──

export interface EncashmentResult {
    resp_code: string;
    resp_desc: string;
    trans_stat?: string;
    hf_seq_id?: string;
}

/** 教练从汇付账户取现到绑定的银行卡 */
export async function encashmentForCoach(params: {
    reqDate: string;
    reqSeqId: string;
    cashAmtYuan: string;
    huifuId: string;
    tokenNo: string; // 绑卡后返回的取现卡序列号
    intoAcctDateType?: string; // D0/T1/D1/DM，默认 T1
    acctId?: string; // 指定账户号，不填默认基本户
}): Promise<EncashmentResult> {
    const payload: HuifuPayload = {
        req_date: params.reqDate,
        req_seq_id: params.reqSeqId,
        huifu_id: params.huifuId,
        cash_amt: params.cashAmtYuan,
        into_acct_date_type: params.intoAcctDateType || "T1",
        token_no: params.tokenNo,
    };

    if (params.acctId) {
        payload.acct_id = params.acctId;
    }

    return huifuPost<EncashmentResult>("/v2/trade/settlement/encashment", payload);
}
