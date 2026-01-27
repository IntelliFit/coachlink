export interface MergeActionsDto {
    keepActionId: string;
    mergeActionIds: string[];
    applyToTemplates?: boolean;
    applyToInstances?: boolean;
    deleteMerged?: boolean;
}

export interface MergeActionsResponseDto {
    replacedCount: number;
    updatedTemplates: number;
    updatedInstances: number;
    deletedActions: number;
}

