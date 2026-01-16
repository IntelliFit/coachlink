import { AlipayOrderRow } from "@/types";

// 请求参数的接口类型
export interface QueryAlipayOrderDto {
    orderId: string;
}

// 返回参数的接口类型
export interface QueryAlipayOrderResponseDto {
    order: AlipayOrderRow;
    tradeStatus: TradeStatus;
}

export type TradeStatus = 'WAIT_BUYER_PAY' | 'TRADE_CLOSED' | 'TRADE_SUCCESS' | 'TRADE_FINISHED';