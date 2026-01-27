export interface ActionReferencesDto {
    actionIds: string[];
}

export interface ActionReferenceTemplateItem {
    templateId: string;
    name: string;
    matchCount: number;
}

export interface ActionReferenceInstanceItem {
    instanceId: string;
    name: string;
    status: string | null;
    studentId: string | null;
    matchCount: number;
}

export interface ActionReferencesResponseDto {
    templates: ActionReferenceTemplateItem[];
    instances: ActionReferenceInstanceItem[];
    totals: {
        templateCount: number;
        instanceCount: number;
        matchCount: number;
    };
}

