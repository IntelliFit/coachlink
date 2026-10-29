import type { LocationGap } from '@coachlink/core';
import type { StreetliftingLocation } from "../list/entity";

export interface StreetliftingMyLocation extends StreetliftingLocation {
    gaps: LocationGap[];
}

export interface StreetliftingMyLocationsSummary {
    upload_count: number;
    image_count_total: number;
    needs_update_count: number;
    contribution_score: number | null;
    /** 1-based leaderboard position; null until the leaderboard has been rebuilt. */
    rank: number | null;
}

export interface StreetliftingMyLocationsResponseDto {
    locations: StreetliftingMyLocation[];
    summary: StreetliftingMyLocationsSummary;
}
