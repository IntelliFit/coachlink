export interface ListImpromptuActionsDto {}

export interface ImpromptuActionOption {
    id: string;
    name: string;
    type?: string;
    detail?: string | null;
    positions?: string[] | null;
    attrs?: string[] | null;
    item_schema?: Record<string, unknown> | null;
    suggested_time?: string | null;
    canonical_action_id?: string | null;
    category?: string | null;
    reference_image_url?: string | null;
    usage_count: number;
    last_used_at: string | null;
}

export interface ListImpromptuActionsResponseDto {
    actions: ImpromptuActionOption[];
}

