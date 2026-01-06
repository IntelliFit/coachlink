export interface ActivateInstanceDto {
    instanceId: string;
    archiveCurrentIfExists?: boolean; // 默认 true
}

export interface ActivateInstanceResponseDto {
    success: boolean;
    newActiveInstance?: any;
    previousInstance?: {
        id: string;
        newStatus: string;
    };
}
