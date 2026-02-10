export interface SubmitPublicActionEditDto {
    actionId: string;
    name?: string | null;
    detail?: string | null;
    positions?: string[] | null;
    attrs?: string[] | null;
    url?: string | null;
    type?: string | null;
    item_schema?: any | null;
    suggested_time?: string | null;
    enableAutoWeightCompute?: boolean | null;
    includesBodyWeight?: boolean | null;
    canonical_action_id?: string | null;
}

export interface SubmitPublicActionEditResponseDto {
    edit: any;
}

