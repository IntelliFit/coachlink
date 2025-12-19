import { CoachSubscriptionRow } from "@/types";

export interface GetSubscriptionDto {
    id: string;
}

export interface GetSubscriptionResponseDto {
    subscription: CoachSubscriptionRow | null;
}