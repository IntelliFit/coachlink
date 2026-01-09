// 获取个人记录请求和响应的类型定义

export interface GetPersonalRecordsDto {
}

export interface PersonalRecord {
    id: string;
    exercise_name: string;
    weight: number; // Training weight
    reps: number; // Training reps
    e1rm: number; // Calculated e1RM (estimated 1 rep max)
    date_achieved: string;
    notes?: string;
}

export interface GetPersonalRecordsResponseDto {
    personalRecords: {
        id: string;
        exercise_name: string;
        weight: number;
        reps: number;
        e1rm: number;
        date_achieved: string;
        notes?: string;
    }[];
}
