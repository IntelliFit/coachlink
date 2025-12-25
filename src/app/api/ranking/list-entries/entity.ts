import { LeaderboardEntriesRow } from "@/types";

export interface ListEntriesDto {
    template_id?: string;
    user_id?: string;
    status?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
}

export interface LeaderboardEntryWithProfile extends LeaderboardEntriesRow {
    userProfile: {
        name: string;
        avatar: string;
    };
}

export interface ListEntriesResponseDto {
    entries: LeaderboardEntryWithProfile[];
    total: number;
    page: number;
    limit: number;
}