import { CoachContentRow } from "@/types"

export interface GetContentByIdDto {
    contentId: string;
    viewerId?: string;
}

export interface GetContentByIdResponseDto {
    content: CoachContentRow | null;
    accessTier: number;
}