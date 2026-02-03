export interface PendingEditsSummaryDto {}

export interface PendingEditsSummaryItemDto {
    actionId: string;
    name: string;
    pendingCount: number;
}

export interface PendingEditsSummaryResponseDto {
    totalPending: number;
    actions: PendingEditsSummaryItemDto[];
}

