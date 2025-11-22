export interface GetActionsDto {
    coach_id: string;
    search?: string;
    page: number;
    limit: number;
}

export interface ExerciseAction {
    id: string;
    coach_id: string;
    name: string;
    description: string;
    video_url?: string;
    type: 'strength' | 'cardio' | 'flexibility' | 'other';
    created_at: string;
    updated_at: string;
}

export interface GetActionsResponseDto {
    actions: ExerciseAction[];
    total: number;
    page: number;
    limit: number;
}