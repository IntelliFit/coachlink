import { CoachLinkTable, CoachPlanTemplateRow } from "@/types";

export interface CreateAiInstanceDto {
    subscriptionId: string;
    /** 起始周，从1开始计数，默认为1 */
    startWeek?: number;
    /** 起始天，从1开始计数（1-7代表周内第几天），默认为1 */
    startDay?: number;
    /** 是否保留原始周次编号，默认true */
    keepOriginalIndex?: boolean;
    /** 是否使用 LLM 深度个性化生成，默认 false */
    useLLM?: boolean;
}

export interface CreateAiInstanceResponseDto {
    template: CoachLinkTable["coach_plan_instances"]["Insert"];
}
