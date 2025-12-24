import { UserProfilesRow } from "@/types";

export interface GetStudentsDto {
    pagination: {
        page: number;
        limit: number;
    };
    needTrainingDetails?: boolean;
}

export interface SubscribeData {
    answers: { answer: string; question: string }[];
}

export interface StudentSubscription {
    id: string;
    student_id: string;
    tier: string;
    status: string;
    start_date: string;
    end_date: string;
    updated_at: string;
    profile: UserProfilesRow | null;
    uploaded: number;
    reviewed: number;
    monthly_price: number;
    subscribe_data: SubscribeData | null;
    subscribed_weeks: number | null;
}

export interface ListStudentsDto {
    pagination: {
        page: number;
        limit: number;
    };
}

export interface ListStudentsResponseDto {
    students: StudentSubscription[];
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
}
