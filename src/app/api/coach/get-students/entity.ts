import { UserProfilesRow } from "@/types";

export interface GetStudentsDto {
    pagination: {
        page: number;
        limit: number;
    };
    needTrainingDetails?: boolean;
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
}

export interface GetStudentsResponseDto {
    students: StudentSubscription[];
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
}