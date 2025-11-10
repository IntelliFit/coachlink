import { number } from "framer-motion"

export interface GetContentsDto {
    coachId: string,
    viewerId?: string,
    limit: number
    offset: number,
    content_type?: string,
    required_tier?: number
}