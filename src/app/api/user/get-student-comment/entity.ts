import type { ApiData } from '@/types/api';
import type { CoachStudentCommentRow } from '@/types';

// 请求参数的接口类型
export interface GetStudentCommentDto {
    id?: string;
    coach_id?: string;
    student_id?: string;
}

// 返回参数的接口类型
export interface GetStudentCommentResponseDto {
    comments: CoachStudentCommentRow[];
}

export type GetStudentCommentApiResponse = ApiData<GetStudentCommentResponseDto>;