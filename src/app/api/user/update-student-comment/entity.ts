import type { ApiData } from '@/types/api';
import type { CoachStudentCommentRow } from '@/types';

// 请求参数的接口类型
export interface UpdateStudentCommentDto {
    id: string;
    comment?: string;
    media?: any;
}

// 返回参数的接口类型
export interface UpdateStudentCommentResponseDto {
    comment: CoachStudentCommentRow;
}

export type UpdateStudentCommentApiResponse = ApiData<UpdateStudentCommentResponseDto>;