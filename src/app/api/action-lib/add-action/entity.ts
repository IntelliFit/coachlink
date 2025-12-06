import { CoachActionRow, CoachLinkTable } from "@/types";


export type AddActionDto = Omit<CoachLinkTable['coach_actions']['Insert'], 'coach_id'>;

export interface AddActionResponseDto {
    action: CoachActionRow
}