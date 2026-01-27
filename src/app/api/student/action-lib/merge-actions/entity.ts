export interface MergeStudentActionsDto {
    keepActionId: string;
    mergeActionIds: string[];
    applyToInstances?: boolean;
    deleteMerged?: boolean;
}

export interface MergeStudentActionsResponseDto {
    replacedCount: number;
    updatedInstances: number;
    deletedActions: number;
}

