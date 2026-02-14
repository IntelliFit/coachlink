export interface ListImpromptuActionsDto {}

export interface ImpromptuActionOption {
    id: string;
    name: string;
    type?: string;
}

export interface ListImpromptuActionsResponseDto {
    actions: ImpromptuActionOption[];
}

