export interface GenerateAIPlanDto {
    userId: string;
    preferences: {
        goal: string;
        level: string;
        focus: string;
        duration: number;
        frequency: number;
        equipment: string;
        time_per_session: number;
        injuries: string;
        specific_goals: string;
    };
}

export interface GenerateAIPlanResponseDto {
    id: string;
    title: string;
    description: string;
    difficulty_level: string;
    duration_weeks: number;
    exercises: any[];
    created_at: string;
    [key: string]: any;
}
