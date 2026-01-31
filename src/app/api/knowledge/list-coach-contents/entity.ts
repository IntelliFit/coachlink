import type { CoachContentRow } from "@/types";

export interface ListCoachContentsDto {
    limit?: number;
    offset?: number;
    content_type?: string;
}

export type CoachContentListItem = {
    content: CoachContentRow;
    coach: {
        id: string;
        name: string;
        avatar_url: string | null;
        status: string | null;
    };
    accessTier: number;
    canView: boolean;
};

export interface ListCoachContentsResponseDto {
    items: CoachContentListItem[];
    total: number;
    limit: number;
    offset: number;
}

