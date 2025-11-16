// 更新个人记录请求和响应的类型定义

export interface UpdatePersonalRecordsDto {
    userId: string;
    exercises: {
        name: string;
        load_actual?: number;
        sets_completed?: number;
        week_number?: number;
        day_of_week?: string;
    }[];
}

export type UpdatePersonalRecordsResponseDto = string;