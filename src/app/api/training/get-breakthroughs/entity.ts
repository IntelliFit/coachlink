/**
 * 获取训练进步记录（Breakthroughs）的 DTO 定义
 */

export interface GetBreakthroughsDto {
    training_plan_id: string;
    user_id?: string;
}

export interface BreakthroughRecord {
    date: string;
    exercise_name: string;
    exercise_category: 'main' | 'accessory';
    weight: number;
    reps: number;
    estimated_1rm: number;
    week_number: number;
    day_number: number;
}

export interface GetBreakthroughsResponseDto {
    success: boolean;
    data: {
        breakthroughs: BreakthroughRecord[];
        totalCount: number;
        exerciseCount: number;
    };
    message?: string;
}




