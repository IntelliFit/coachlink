import type { StreetliftingStory } from "../list/entity";

export interface StreetliftingCreateStoryDto {
    title: string;
    content?: string | null;
    video_url?: string | null;
    type?: "story" | "event";
    event_date?: string | null;
    user_contact?: string | null;
}

export interface StreetliftingCreateStoryResponseDto {
    story: StreetliftingStory;
}
