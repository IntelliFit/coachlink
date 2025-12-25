export interface ListLeaderboardDto {
    page?: number;
    limit?: number;
}

export interface ListLeaderboardItem {
    id: string;
    title: string;
    description: string | null;
    start_at: string | null;
    end_at: string | null;
    rank_by_field: string;
    sort_order: string | null;
    type: string | null;
    remarks: string | null;
    created_at: string | null;
    creator_id: string | null;
}

export interface ListLeaderboardResponseDto {
    leaderboards: ListLeaderboardItem[];
    total: number;
    page: number;
    limit: number;
    unreviewedCount: number;
}