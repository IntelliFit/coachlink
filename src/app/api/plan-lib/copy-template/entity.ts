import { Database } from "@/types/database.types";

export interface CopyTemplateDto {
    id: string;
}

export interface CopyTemplateResponseDto {
    template: Database["public"]["Tables"]["coach_plan_templates"]["Row"];
}
