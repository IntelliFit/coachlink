import type { CoachSubscriptionOrderRow } from "@/types/subscriptionOrders";
import type { CoachSubscriptionRow } from "@/types";

export interface ConfirmSubscriptionOrderDto {
    orderId: string;
}

export interface ConfirmSubscriptionOrderResponseDto {
    subscriptionOrder: CoachSubscriptionOrderRow;
    subscription: CoachSubscriptionRow;
}
