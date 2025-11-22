import { CoachActionRow } from "@/types";

export type AddActionRequest = Partial<CoachActionRow> & {
  name: string;
  description: string;
};

export type AddActionResponse = {
  success: boolean;
  action?: CoachActionRow;
  message?: string;
};

export interface AddActionDto {
    coach_id: string;
    name: string;
    description: string;
    video_url?: string;
    type: 'strength' | 'cardio' | 'flexibility' | 'other';
}

export interface AddActionResponseDto {
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