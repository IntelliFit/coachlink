import { CoachContentRow } from "@/types"

export interface GetContentsDto {
    coachId: string,
    viewerId?: string,
    limit: number
    offset: number,
    content_type?: string,
    required_tier?: number
}

export type GetContentsListItem = CoachContentRow & {
    /** 当前查看者无权限阅读时为 true，content/media_urls 在服务端已脱敏 */
    is_locked: boolean
}

export interface GetContentsResponseDto {
    contents: GetContentsListItem[],
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