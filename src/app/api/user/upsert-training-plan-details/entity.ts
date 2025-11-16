// 保存训练计划详情请求和响应的类型定义

export interface PlanDetailItem {
    week_number: number;
    day_of_week: string;
    session_focus?: string;
    main_exercises?: any;
    accessory_exercises?: any;
    warmup?: any;
    cooldown?: any;
    notes?: string;
    order_index?: number;
}

export interface UpsertTrainingPlanDetailsDto {
    training_plan_id: string;
    details: PlanDetailItem[];
}

export type UpsertTrainingPlanDetailsResponseDto = any[];