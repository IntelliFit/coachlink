import { CoachContentRow } from "@/types"

export interface GetContentsDto {
    coachId: string,
    viewerId?: string,
    limit: number
    offset: number,
    content_type?: string,
    required_tier?: number
}

export interface GetContentsResponseDto {
    contents: CoachContentRow[],
    total: number,
    limit: number,
    offset: number,
    coach: {
        id: string | null,
        name: string,
        status: string | null
    },
    accessTier: number
}