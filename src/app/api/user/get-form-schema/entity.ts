export type GetFormSchemaDto = {
    coachId: string;
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

export interface GetFormSchemaResponseDto {
    formSchema: {
        fields: FormField[];
    } | null;
}