export interface StudentActionReferencesDto {
    actionIds: string[];
}

export interface StudentActionReferenceInstanceItem {
    instanceId: string;
    name: string;
    status: string | null;
    matchCount: number;
}

export interface StudentActionReferencesResponseDto {
    instances: StudentActionReferenceInstanceItem[];
    totals: {
        instanceCount: number;
        matchCount: number;
    };
}

