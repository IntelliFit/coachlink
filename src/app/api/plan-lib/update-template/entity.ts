import { CoachLinkTable, CoachPlanTemplateRow } from "@/types";
import { CoachPlanTrainingDay } from "../create-template/entity";

export type CoachPlanTemplatesUpdate =
    CoachLinkTable["coach_plan_templates"]["Update"];

// 请求参数的接口类型
export interface UpdateTemplateDto {
    id: string;
    name?: string;
    description?: string | null;
    executionNotice?: string | null;
    tags?: string[];
    suitableFor?: string;
    weekDays?: number[];
    globalAnswers?: Record<string, number>; // 新增：全局问题答案
    trainingDays?: CoachPlanTrainingDay[];
    syncInstances?: boolean;
}

// 返回参数的接口类型
export interface UpdateTemplateResponseDto {
    template: CoachPlanTemplateRow;
}
