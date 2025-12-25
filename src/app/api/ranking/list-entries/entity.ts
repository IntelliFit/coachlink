import { LeaderboardEntriesRow } from "@/types";

export interface ListEntriesDto {
    template_id?: string;
    user_id?: string;
    page?: number;
    limit?: number;
}

export interface ListEntriesResponseDto {
    entries: LeaderboardEntriesRow[];
    total: number;
    page: number;
    limit: number;
}