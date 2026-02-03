export interface SyncPublicActionToMyLibDto {
    actionId: string;
    targetActionType?: "student" | "coach";
}

export interface SyncPublicActionToMyLibResponseDto {
    action: any;
}

