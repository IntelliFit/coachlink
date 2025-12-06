import { CoachActionRow, CoachLinkTable } from "@/types";

export type UpdateActionRequest = Partial<CoachActionRow> & {
  id: string;
};

export type UpdateActionResponse = {
  success: boolean;
  action?: CoachActionRow;
  message?: string;
};

export type UpdateActionDto = CoachLinkTable['coach_actions']['Update'];

export interface UpdateActionResponseDto {
    action: {
        id: string;
        coach_id: string;
        name: string;
        description: string;
        video_url?: string;
        type: 'strength' | 'cardio' | 'flexibility' | 'other';
        created_at: string;
        updated_at: string;
    };
}