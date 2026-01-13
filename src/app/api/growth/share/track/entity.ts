export interface TrackGrowthShareEventDto {
    shareId: string;
    eventType: "visit" | "register_success";
    meta?: Record<string, any>;
}

export interface TrackGrowthShareEventResponseDto {
    shareId: string;
    ok: boolean;
}

