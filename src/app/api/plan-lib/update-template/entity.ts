import { CoachPlanTemplateRow, CoachLinkTable } from "@/types";
import { CoachPlanTrainingDay } from "../add-template/entity";

export type CoachPlanTemplatesUpdate = CoachLinkTable['coach_plan_templates']['Update'];

// 请求参数的接口类型
export interface UpdateTemplateDto {
    id: string;
    name?: string;
    description?: string | null;
    tags?: string[];
    suitableFor?: string;
    trainingDays?: CoachPlanTrainingDay[];
}

// 返回参数的接口类型
export interface UpdateTemplateResponseDto {
    template: CoachPlanTemplateRow;
}