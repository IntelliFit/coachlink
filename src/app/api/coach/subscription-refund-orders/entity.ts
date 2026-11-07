import type { CoachRefundOrder } from "@coachlink/core/src/coachRefund";

export interface CoachRefundOrdersDto {
    subscriptionId: string;
}

export interface CoachRefundOrdersResponseDto {
    /** Refundable paid orders of the subscription, newest first. Empty when none. */
    orders: CoachRefundOrder[];
}
