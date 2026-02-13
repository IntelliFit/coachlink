// Request DTO
export interface GetCurrent1RMDto {
    actionIds?: string[]; // Optional: specific action IDs
    actionNames?: string[]; // Optional: specific action names
    targetUserId?: string; // Optional: fetch for a specific user (if caller is coach)
    preferPR?: boolean; // Optional: use PR-oriented aggregation (mainly increasing)
}

// Response DTO
export interface Current1RMRecord {
    actionId?: string;
    actionName: string;
    current1RM: number; // This is the e1RM value
    lastUpdated: string;
    isAutoCalculated: boolean;
}

export interface GetCurrent1RMResponseDto {
    records: Current1RMRecord[];
}
