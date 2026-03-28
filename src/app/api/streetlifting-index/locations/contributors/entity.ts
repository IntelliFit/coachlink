export interface StreetliftingLocationContributorsDto {
    limit?: number;
}

export interface StreetliftingLocationContributorItem {
    contributor_key: string;
    contributor_user_id: string | null;
    display_name: string;
    upload_count: number;
    detail_score_total: number;
    image_count_total: number;
    contribution_score: number;
    last_contributed_at: string | null;
}

export interface StreetliftingLocationContributorsResponseDto {
    contributors: StreetliftingLocationContributorItem[];
}
