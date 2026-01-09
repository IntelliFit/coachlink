// Request DTO
export interface GetE1RMHistoryDto {
    actionId?: string;
    actionName?: string; // Optional fallback
    startDate?: string;
    endDate?: string;
    limit?: number;
}

// Response DTO
export interface E1RMHistoryPoint {
    date: string;
    e1rm: number;
    isPR: boolean; // Computed dynamically
    source: "initial" | "execution" | "manual_pr";
    weight?: number;
    reps?: number;
}

export interface GetE1RMHistoryResponseDto {
    history: E1RMHistoryPoint[];
    currentPR?: number;
}
