import type { ApiData } from '@/types/api';
import type { CoachStudentCommentRow } from '@/types';

// 请求参数的接口类型
export interface CreateStudentCommentDto {
    coach_id: string;
    comment: string;
    rating: number;
    media?: any;
}

// 返回参数的接口类型
export interface CreateStudentCommentResponseDto {
    comment: CoachStudentCommentRow;
}

export type CreateStudentCommentApiResponse = ApiData<CreateStudentCommentResponseDto>;