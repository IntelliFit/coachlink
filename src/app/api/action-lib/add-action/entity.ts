import { CoachActionRow, CoachLinkTable } from "@/types";


export type AddActionDto = Partial<CoachLinkTable['coach_actions']['Insert']>;

export interface AddActionResponseDto {
    action: CoachActionRow
}