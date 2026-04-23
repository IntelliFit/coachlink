import type { Json } from "@/types/database.types";
import type { CoachSubscriptionOrderRow } from "@/types/subscriptionOrders";

export interface UpdateSubscriptionOrderDto {
    id: string;
    status?: "pending_confirmation";
    paymentMethod?: string | null;
    note?: string | null;
    paymentData?: Json | null;
    coachSeenAt?: string | null;
}

export interface UpdateSubscriptionOrderResponseDto {
    subscriptionOrder: CoachSubscriptionOrderRow;
}
