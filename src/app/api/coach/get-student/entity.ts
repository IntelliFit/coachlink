import { UserProfilesRow } from "@/types";

// 请求参数的接口类型
export interface GetStudentDto {
    studentId?: string;
    subscriptionId?: string;
}

// 返回参数的接口类型
export interface GetStudentResponseDto {
    student: {
        id: string;
        student_id: string;
        tier: number;
        status: string;
        start_date: string;
        end_date: string;
        updated_at: string;
        subscribe_data: any;
        monthly_price: number;
        profile: UserProfilesRow;
        uploaded: number;
        reviewed: number;
    } | null;
}