import { CoachPlanInstanceRow, UserProfilesRow } from "@/types";

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
    tier: number;
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

    // 学员迁入平台前已跟随教练训练的周数
    prior_training_weeks: number | null;

    plan: {
        name: string;
        description: string;
        status: string;
        [key: string]: any;
    };

    // 统计执行进度
    progress: {
        total: number;
        completed: number;
    };
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
