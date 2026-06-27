import { CoachApplicationRow } from "@/types";


export interface AdminNavDataDto {
}

export interface AdminNavDataResponseDto {
    paymentUnreviewed: number;
    coachApplicationUnreviewed: number;
    rankingRecordsUnreviewed: number;
    feedbackOpen: number;
}
