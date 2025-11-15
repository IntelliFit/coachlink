// 获取个人记录请求和响应的类型定义

export interface GetPersonalRecordsDto {
}

export interface PersonalRecord {
    id: string;
    exercise_name: string;
    max_weight: number;
    max_reps: number;
    date_achieved: string;
    notes?: string;
}

export interface GetPersonalRecordsResponseDto {
    personalRecords: {
        id: string;
        exercise_name: string;
        max_weight: number;
        max_reps: number;
        date_achieved: string;
        notes?: string;
    }[]
}