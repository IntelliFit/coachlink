export interface UpdateCoachProfileDto {
    id: string;
    bio?: string;
    profile?: {
        teachingPhilosophy?: string;
        achievements?: string[];
    };
}

export interface UpdateCoachProfileResponseDto {
    success: boolean;
    data?: any;
    error?: string;
}