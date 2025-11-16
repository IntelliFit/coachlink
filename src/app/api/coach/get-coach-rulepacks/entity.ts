export interface GetCoachRulepacksDto {
    coach_id: string;
    domain: string;
}

export interface FormField {
    name: string;
    type: string;
    label: string;
    required: boolean;
    min?: number;
    max?: number;
    options?: any[];
    placeholder?: string;
}

export interface RulepackFormSchema {
    fields: FormField[];
}

export interface GetCoachRulepacksResponseDto {
    form_schema: RulepackFormSchema | null;
}