import type { CoachPaymentRecordRow } from "@/types/subscriptionOrders";

export interface GetPaymentWaitingStudentsDto {

}

export interface GetPaymentWaitingStudentsResponseDto {
    /** 需要教练人工确认的订阅（个人收款码/线下） */
    manualSubscriptions: CoachPaymentRecordRow[];
    /** 平台支付已自动确认，但教练尚未在“待支付确认”入口查看过的通知 */
    systemSubscriptions: CoachPaymentRecordRow[];
}
