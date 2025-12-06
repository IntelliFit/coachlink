import type { ApiData } from '@/types/api';

// 请求参数的接口类型
export interface DeleteStudentCommentDto {
    id: string;
}

// 返回参数的接口类型
export interface DeleteStudentCommentResponseDto {}

export type DeleteStudentCommentApiResponse = ApiData<DeleteStudentCommentResponseDto>;