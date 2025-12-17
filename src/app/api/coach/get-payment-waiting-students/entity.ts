import { CoachSubscriptionRow } from "@/types";

export interface GetPaymentWaitingStudentsDto {

}

export interface GetPaymentWaitingStudentsResponseDto {
    subscriptions: CoachSubscriptionRow[];
}