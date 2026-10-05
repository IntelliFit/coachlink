import { yuanToFen } from "@/lib/moneyUtils";
import { queryHuifuHostedWebOrder, queryHuifuMiniProgramOrder } from "@/lib/huifuMiniProgramPay";

type WebOrder = { total_amount?: number | null; order_data?: unknown };

export function isHuifuWebPayment(order: WebOrder) {
    const data = order.order_data as Record<string, unknown> | null;
    return data?.huifu_payment_mode === "hosting" || data?.huifu_trade_type === "T_NATIVE";
}

/** Check the signed original amount before marking a new Web order paid. */
export function assertHuifuWebPaymentAmount(
    order: WebOrder,
    payment: { trans_stat?: unknown; trans_amt?: unknown },
) {
    if (!isHuifuWebPayment(order) || payment.trans_stat !== "S") return;
    const amount = Number(payment.trans_amt);
    if (!Number.isFinite(amount) || amount <= 0 || yuanToFen(amount) !== Number(order.total_amount)) {
        throw new Error("微信支付金额与订阅订单不匹配");
    }
}

export async function queryHuifuPaymentOrder(
    order: WebOrder,
    params: { orgReqDate: string; orgReqSeqId: string },
) {
    const data = order.order_data as Record<string, unknown> | null;
    if (data?.huifu_payment_mode !== "hosting") return queryHuifuMiniProgramOrder(params);

    const result = await queryHuifuHostedWebOrder(params);
    if (result.resp_code !== "00000000") throw new Error(result.resp_desc || "微信支付状态查询失败");
    if ((result.org_req_seq_id && result.org_req_seq_id !== params.orgReqSeqId) ||
        (result.org_req_date && result.org_req_date !== params.orgReqDate)) {
        throw new Error("微信支付查询返回的订单不匹配");
    }
    const orderStatus = String(result.order_stat || "");
    const transStatus = String(result.trans_stat || "");
    if (orderStatus === "1" && (transStatus === "F" || result.close_stat === "S")) {
        throw new Error("微信支付状态冲突，请稍后重试");
    }
    // A failed attempt can still belong to a payable hosted order. Only settle final success.
    const status = ["3", "5", "6"].includes(orderStatus)
        ? "F"
        : result.close_stat === "S"
          ? "C"
          : orderStatus === "1"
            ? "S"
            : ["2", "4"].includes(orderStatus)
              ? "P"
              : transStatus || "P";
    return { ...result, trans_stat: status };
}
