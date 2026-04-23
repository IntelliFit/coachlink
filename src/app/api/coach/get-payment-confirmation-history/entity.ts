import type { CoachPaymentRecordRow } from "@/types/subscriptionOrders";

export interface GetPaymentConfirmationHistoryDto {
  /** 返回条数（默认 50） */
  limit?: number;
}

export interface GetPaymentConfirmationHistoryResponseDto {
  /** 已确认支付的订阅（教练确认 or 系统确认） */
  subscriptions: CoachPaymentRecordRow[];
}

