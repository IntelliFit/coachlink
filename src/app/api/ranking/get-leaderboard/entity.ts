import { LeaderboardFormInput, LeaderboardRule } from "@/types/leaderboard";

export interface GetLeaderboardDto {
    id: string;
}

export interface GetLeaderboardResponseDto {
    leaderboard: {
        id: string;
        title: string;
        description: string | null;
        start_at: string | null;
        end_at: string | null;
        rank_by_field: string;
        sort_order: string | null;
        type: string | null;
        rules: LeaderboardRule[];
        form_schema: LeaderboardFormInput[];
        remarks: string | null;
        created_at: string | null;
        creator_id: string | null;
        initiator: string | null;
    } | null;
}