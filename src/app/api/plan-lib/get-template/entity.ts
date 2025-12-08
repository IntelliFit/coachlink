import { CoachPlanTemplateRow } from "@/types";
import { CoachPlanAction, FormPlanTrainingDay } from "../add-template/entity";

// 请求参数的接口类型
export interface GetTemplateDto {
    id: string;
}

// 返回参数的接口类型
export interface GetTemplateResponseDto {
    template: Omit<CoachPlanTemplateRow, 'days'>; // 排除days字段因为单独返回
    days: FormPlanTrainingDay[];
}