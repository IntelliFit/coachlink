export interface ArchiveInstanceDto {
    instanceId: string;
    archiveReason?: string | null;
    entitlementPolicy?: string | null;
    entitlementNote?: string | null;
}

export interface ArchiveInstanceResponseDto {
    success: boolean;
    instance?: any;
}
