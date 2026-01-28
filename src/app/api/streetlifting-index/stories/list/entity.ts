export interface StreetliftingStory {
    id: string;
    title: string;
    content: string | null;
    video_url: string | null;
    type: "story" | "event";
    event_date: string | null;
    created_at: string;
    user_contact: string | null;
}

export interface StreetliftingListStoriesDto {}

export interface StreetliftingListStoriesResponseDto {
    stories: StreetliftingStory[];
}
