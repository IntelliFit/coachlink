export interface CreateLeaderboardDto {
    title: string;
    description?: string;
    start_at?: string;
    end_at?: string;
    rank_by_field: string;
    sort_order?: string;
    type?: string;
    rules?: any;
    form_schema?: any;
    remarks?: string;
    initiator?: string;
    needReview?: boolean;
}

export interface CreateLeaderboardResponseDto {
    id: string;
}