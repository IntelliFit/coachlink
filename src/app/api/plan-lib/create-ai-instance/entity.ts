import { CoachLinkTable, CoachPlanTemplateRow } from "@/types";

export interface CreateAiInstanceDto {
    subscriptionId: string;
}

export interface CreateAiInstanceResponseDto {
    template: CoachLinkTable['coach_plan_instances']['Insert'];
}