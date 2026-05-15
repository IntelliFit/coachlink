import type { Json } from "@/types/database.types";
import type { CoachSubscriptionOrderRow } from "@/types/subscriptionOrders";

export interface CreateSubscriptionOrderDto {
    coachId: string;
    orderType: "subscribe" | "renew";
    subscriptionId?: string;
    tier?: number;
    monthlyPrice?: number;
    subscribeData?: Json | null;
    productId?: string;
    productName?: string;
    productTier?: string;
    subscribedWeeks?: number;
}

export interface CreateSubscriptionOrderResponseDto {
    subscriptionOrder: CoachSubscriptionOrderRow;
}
