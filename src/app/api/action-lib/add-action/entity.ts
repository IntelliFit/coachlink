import { CoachActionRow } from "@/types";


export interface AddActionDto {
    name: string;
    detail: string;
    url?: string;
    position: string;
}

export interface AddActionResponseDto {
    action: CoachActionRow
}